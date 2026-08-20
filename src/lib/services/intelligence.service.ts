import { db } from '@/src/lib/db';

/**
 * Servicio del subsistema de inteligencia (análisis de datos y ML).
 *
 * Solo LEE el plano analítico (tablas que el pipeline de Python precalcula).
 * En la Fase 0 estas tablas están vacías; las páginas de la trastienda usan
 * estos conteos para mostrar su estado ("en construcción / se poblará cuando
 * corra el pipeline"). Ver docs/machine-learning.md.
 */

export interface IntelligenceOverview {
  demandForecasts: number;
  restockSuggestions: number;
  recommendations: number;
  kpiSnapshots: number;
  customerSegments: number;
  riskScores: number;
  lastRun: { modelType: string; version: string; status: string; finishedAt: Date | null } | null;
}

export async function getIntelligenceOverview(): Promise<IntelligenceOverview> {
  const [
    demandForecasts,
    restockSuggestions,
    recommendations,
    kpiSnapshots,
    customerSegments,
    riskScores,
    lastRun,
  ] = await Promise.all([
    db.demandForecast.count(),
    db.restockSuggestion.count(),
    db.productRecommendation.count(),
    db.kpiSnapshot.count(),
    db.customerSegment.count(),
    db.riskScore.count(),
    db.modelRun.findFirst({
      orderBy: { startedAt: 'desc' },
      select: { modelType: true, version: true, status: true, finishedAt: true },
    }),
  ]);

  return {
    demandForecasts,
    restockSuggestions,
    recommendations,
    kpiSnapshots,
    customerSegments,
    riskScores,
    lastRun,
  };
}

// ── Fase 1: dashboard de métricas descriptivas (lee KpiSnapshot) ──────────

export interface MetricPoint {
  periodStart: Date;
  revenue: number;
  orders: number;
  units: number;
  margin: number;
}
export interface CategoryRow {
  category: string;
  revenue: number;
  margin: number;
  marginPct: number;
}
export interface ProductRow {
  productId: string;
  name: string;
  revenue: number;
  units: number;
  margin: number;
  marginPct: number;
  abc: 'A' | 'B' | 'C';
}
export interface CommuneRow {
  commune: string;
  revenue: number;
  orders: number;
}
export interface MetricsDashboard {
  hasData: boolean;
  lastUpdated: Date | null;
  totals: { revenue: number; orders: number; units: number; margin: number; marginPct: number; aov: number };
  monthly: MetricPoint[];
  categories: CategoryRow[];
  products: ProductRow[];
  communes: CommuneRow[];
}

type Snap = { periodStart: Date; metric: string; value: number; dimension: string; dimensionId: string };

function pivot(rows: Snap[], key: (r: Snap) => string) {
  const map = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const k = key(r);
    const bucket = map.get(k) ?? {};
    bucket[r.metric] = r.value;
    map.set(k, bucket);
  }
  return map;
}

export async function getMetricsDashboard(): Promise<MetricsDashboard> {
  const [monthlyRows, run, categoryRows, productRows, communeRows] = await Promise.all([
    db.kpiSnapshot.findMany({
      where: { periodType: 'MONTH', dimension: '_all' },
      orderBy: { periodStart: 'asc' },
      select: { periodStart: true, metric: true, value: true, dimension: true, dimensionId: true },
    }),
    db.modelRun.findFirst({ where: { modelType: 'kpi_snapshots' }, orderBy: { startedAt: 'desc' } }),
    db.kpiSnapshot.findMany({ where: { dimension: 'category' }, select: { periodStart: true, metric: true, value: true, dimension: true, dimensionId: true } }),
    db.kpiSnapshot.findMany({ where: { dimension: 'product' }, select: { periodStart: true, metric: true, value: true, dimension: true, dimensionId: true } }),
    db.kpiSnapshot.findMany({ where: { dimension: 'commune' }, select: { periodStart: true, metric: true, value: true, dimension: true, dimensionId: true } }),
  ]);

  const monthly: MetricPoint[] = [...pivot(monthlyRows, (r) => r.periodStart.toISOString()).entries()].map(
    ([iso, m]) => ({ periodStart: new Date(iso), revenue: m.revenue ?? 0, orders: m.orders ?? 0, units: m.units ?? 0, margin: m.margin ?? 0 }),
  );

  // Totales de los últimos 12 meses (para las tarjetas)
  const last12 = monthly.slice(-12);
  const sum = (k: keyof MetricPoint) => last12.reduce((a, p) => a + (p[k] as number), 0);
  const revenue = sum('revenue'), orders = sum('orders'), units = sum('units'), margin = sum('margin');
  const totals = {
    revenue, orders, units, margin,
    marginPct: revenue > 0 ? margin / revenue : 0,
    aov: orders > 0 ? revenue / orders : 0,
  };

  const categories: CategoryRow[] = [...pivot(categoryRows, (r) => r.dimensionId).entries()]
    .map(([category, m]) => ({ category, revenue: m.revenue ?? 0, margin: m.margin ?? 0, marginPct: m.revenue ? (m.margin ?? 0) / m.revenue : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  const communes: CommuneRow[] = [...pivot(communeRows, (r) => r.dimensionId).entries()]
    .map(([commune, m]) => ({ commune, revenue: m.revenue ?? 0, orders: m.orders ?? 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  // Productos + clasificación ABC (Pareto sobre revenue)
  const prodPivot = [...pivot(productRows, (r) => r.dimensionId).entries()]
    .map(([productId, m]) => ({ productId, revenue: m.revenue ?? 0, units: m.units ?? 0, margin: m.margin ?? 0 }))
    .sort((a, b) => b.revenue - a.revenue);
  const names = prodPivot.length
    ? new Map((await db.product.findMany({ where: { id: { in: prodPivot.map((p) => p.productId) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]))
    : new Map<string, string>();
  const totalRev = prodPivot.reduce((a, p) => a + p.revenue, 0);
  let cum = 0;
  const products: ProductRow[] = prodPivot.map((p) => {
    cum += p.revenue;
    const share = totalRev > 0 ? cum / totalRev : 1;
    const abc: 'A' | 'B' | 'C' = share <= 0.8 ? 'A' : share <= 0.95 ? 'B' : 'C';
    return { productId: p.productId, name: names.get(p.productId) ?? p.productId, revenue: p.revenue, units: p.units, margin: p.margin, marginPct: p.revenue ? p.margin / p.revenue : 0, abc };
  });

  return {
    hasData: monthly.length > 0,
    lastUpdated: run?.finishedAt ?? null,
    totals,
    monthly,
    categories,
    products,
    communes,
  };
}

// ── Fase 2: forecast, reposición, recomendaciones, segmentos ──────────────

function metric(json: unknown, key: string): number | null {
  if (json && typeof json === 'object' && key in json) {
    const v = (json as Record<string, unknown>)[key];
    return typeof v === 'number' ? v : null;
  }
  return null;
}

export interface ForecastPoint { periodStart: Date; predicted: number; lower: number; upper: number }
export interface ForecastProduct { productId: string; name: string; stock: number; nextMonth: number; points: ForecastPoint[] }

export async function getDemandForecast() {
  const [rows, run] = await Promise.all([
    db.demandForecast.findMany({
      orderBy: [{ productId: 'asc' }, { periodStart: 'asc' }],
      include: { product: { select: { name: true, stock: true } } },
    }),
    db.modelRun.findFirst({ where: { modelType: 'demand_forecast' }, orderBy: { startedAt: 'desc' } }),
  ]);

  const byProduct = new Map<string, ForecastProduct>();
  for (const r of rows) {
    const p = byProduct.get(r.productId) ?? { productId: r.productId, name: r.product.name, stock: r.product.stock, nextMonth: 0, points: [] };
    p.points.push({ periodStart: r.periodStart, predicted: r.predictedQty, lower: r.lowerQty ?? r.predictedQty, upper: r.upperQty ?? r.predictedQty });
    byProduct.set(r.productId, p);
  }
  const products = [...byProduct.values()].map((p) => ({ ...p, nextMonth: p.points[0]?.predicted ?? 0 }))
    .sort((a, b) => b.nextMonth - a.nextMonth);

  return {
    hasData: products.length > 0,
    lastUpdated: run?.finishedAt ?? null,
    mae: metric(run?.metrics, 'mae_promedio'),
    horizon: metric(run?.metrics, 'horizonte_meses'),
    totalNextMonth: products.reduce((a, p) => a + p.nextMonth, 0),
    products,
  };
}

export interface RestockRow { productId: string; name: string; stock: number; suggestedQty: number; daysToStockout: number | null; reason: string; score: number }

export async function getRestockSuggestions() {
  const [rows, run] = await Promise.all([
    db.restockSuggestion.findMany({ orderBy: { score: 'desc' }, include: { product: { select: { name: true, stock: true } } } }),
    db.modelRun.findFirst({ where: { modelType: 'restock' }, orderBy: { startedAt: 'desc' } }),
  ]);
  const suggestions: RestockRow[] = rows.map((r) => ({
    productId: r.productId, name: r.product.name, stock: r.product.stock,
    suggestedQty: r.suggestedQty, daysToStockout: r.daysToStockout, reason: r.reason, score: r.score,
  }));
  return {
    hasData: suggestions.length > 0,
    lastUpdated: run?.finishedAt ?? null,
    urgent: suggestions.filter((s) => s.score >= 0.5).length,
    suggestions,
  };
}

export interface RecoGroup { productId: string; name: string; items: { name: string; score: number }[] }

export async function getRecommendations() {
  const [rows, run] = await Promise.all([
    db.productRecommendation.findMany({
      where: { strategy: 'BASKET' },
      orderBy: [{ productId: 'asc' }, { score: 'desc' }],
      include: { product: { select: { name: true } }, recommended: { select: { name: true } } },
    }),
    db.modelRun.findFirst({ where: { modelType: 'market_basket' }, orderBy: { startedAt: 'desc' } }),
  ]);
  const byAnchor = new Map<string, RecoGroup>();
  for (const r of rows) {
    const g = byAnchor.get(r.productId) ?? { productId: r.productId, name: r.product.name, items: [] };
    g.items.push({ name: r.recommended.name, score: r.score });
    byAnchor.set(r.productId, g);
  }
  return {
    hasData: byAnchor.size > 0,
    lastUpdated: run?.finishedAt ?? null,
    groups: [...byAnchor.values()].sort((a, b) => (b.items[0]?.score ?? 0) - (a.items[0]?.score ?? 0)),
  };
}

export interface FraudRow {
  orderId: string;
  orderNumber: number | null;
  total: number;
  createdAt: Date | null;
  method: string | null;
  paymentStatus: string | null;
  score: number;
  reasons: string[];
}

export async function getFraudRisk() {
  const [scores, run] = await Promise.all([
    db.riskScore.findMany({ where: { subjectType: 'ORDER' }, orderBy: { score: 'desc' } }),
    db.modelRun.findFirst({ where: { modelType: 'fraud' }, orderBy: { startedAt: 'desc' } }),
  ]);

  const orders = scores.length
    ? new Map((await db.order.findMany({
        where: { id: { in: scores.map((s) => s.subjectId) } },
        select: { id: true, orderNumber: true, totalCLP: true, createdAt: true, shippingMethod: true, paymentStatus: true },
      })).map((o) => [o.id, o]))
    : new Map();

  const rows: FraudRow[] = scores.map((s) => {
    const o = orders.get(s.subjectId);
    return {
      orderId: s.subjectId,
      orderNumber: o?.orderNumber ?? null,
      total: o?.totalCLP ?? 0,
      createdAt: o?.createdAt ?? null,
      method: o?.shippingMethod ?? null,
      paymentStatus: o?.paymentStatus ?? null,
      score: s.score,
      reasons: Array.isArray(s.reasons) ? (s.reasons as string[]) : [],
    };
  });

  const reviewed = await db.order.count();
  return {
    hasData: rows.length > 0,
    lastUpdated: run?.finishedAt ?? null,
    flagged: rows.length,
    totalOrders: reviewed,
    rows,
  };
}

// ── Fase 5: gobernanza — historial de modelos (MLOps / trazabilidad) ──────

export interface ModelRunRow {
  modelType: string;
  version: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  durationSec: number | null;
  rowsIn: number | null;
  metrics: Record<string, unknown> | null;
}

export async function getModelRuns() {
  const runs = await db.modelRun.findMany({ orderBy: { startedAt: 'desc' }, take: 40 });
  const rows: ModelRunRow[] = runs.map((r) => ({
    modelType: r.modelType,
    version: r.version,
    status: r.status,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    durationSec: r.finishedAt ? (r.finishedAt.getTime() - r.startedAt.getTime()) / 1000 : null,
    rowsIn: r.rowsIn,
    metrics: r.metrics && typeof r.metrics === 'object' ? (r.metrics as Record<string, unknown>) : null,
  }));
  // Última corrida exitosa por tipo de modelo (para monitoreo/drift)
  const latestByType = new Map<string, ModelRunRow>();
  for (const r of rows) {
    if (!latestByType.has(r.modelType) && r.status === 'SUCCESS') latestByType.set(r.modelType, r);
  }
  return {
    hasData: rows.length > 0,
    rows,
    latest: [...latestByType.values()],
    successRate: rows.length ? rows.filter((r) => r.status === 'SUCCESS').length / rows.length : 0,
  };
}

// ── Fase 4: conversión, carritos, búsquedas sin resultado, CLV ────────────

export interface FunnelStage { stage: string; sessions: number }
export interface ConversionAnalytics {
  hasData: boolean;
  funnel: FunnelStage[];
  overallConversion: number;
  abandoned: number;
  recoverable: number;
  noResultSearches: { query: string; count: number }[];
}

export async function getConversionAnalytics(): Promise<ConversionAnalytics> {
  const [agg] = await db.$queryRaw<{ views: bigint; carts: bigint; checkouts: bigint; abandons: bigint; recoverable: bigint }[]>`
    SELECT
      COUNT(DISTINCT CASE WHEN type = 'PRODUCT_VIEW'    THEN "sessionId" END) AS views,
      COUNT(DISTINCT CASE WHEN type = 'ADD_TO_CART'     THEN "sessionId" END) AS carts,
      COUNT(DISTINCT CASE WHEN type = 'CHECKOUT_START'  THEN "sessionId" END) AS checkouts,
      COUNT(DISTINCT CASE WHEN type = 'CHECKOUT_ABANDON' THEN "sessionId" END) AS abandons,
      COUNT(DISTINCT CASE WHEN type = 'CHECKOUT_ABANDON' AND "userId" IS NOT NULL THEN "sessionId" END) AS recoverable
    FROM "AnalyticsEvent"`;

  const views = Number(agg?.views ?? 0);
  const carts = Number(agg?.carts ?? 0);
  const checkouts = Number(agg?.checkouts ?? 0);
  const abandons = Number(agg?.abandons ?? 0);
  const completed = Math.max(0, checkouts - abandons);

  const searches = await db.analyticsEvent.groupBy({
    by: ['query'],
    where: { type: 'SEARCH', metadata: { path: ['results'], equals: 0 }, query: { not: null } },
    _count: { _all: true },
  });

  return {
    hasData: views > 0,
    funnel: [
      { stage: 'Vieron un producto', sessions: views },
      { stage: 'Agregaron al carrito', sessions: carts },
      { stage: 'Iniciaron el checkout', sessions: checkouts },
      { stage: 'Completaron (est.)', sessions: completed },
    ],
    overallConversion: views > 0 ? completed / views : 0,
    abandoned: abandons,
    recoverable: Number(agg?.recoverable ?? 0),
    noResultSearches: searches
      .map((s) => ({ query: s.query ?? '', count: s._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
  };
}

export async function getCustomerValue() {
  const paid = await db.order.groupBy({
    by: ['userId'],
    where: { paymentStatus: 'PAID' },
    _sum: { totalCLP: true },
  });
  if (paid.length === 0) return { avgClv: 0, customers: 0 };
  const values = paid.map((p) => p._sum.totalCLP ?? 0);
  return { avgClv: values.reduce((a, v) => a + v, 0) / values.length, customers: values.length };
}

export interface IncidentAnalytics {
  hasData: boolean;
  total: number;
  open: number;
  affectsPersonalData: number;
  mttrHours: number | null;
  byCategory: { category: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
}

export async function getIncidentAnalytics(): Promise<IncidentAnalytics> {
  const [total, open, pii, byCat, bySev, resolved] = await Promise.all([
    db.securityIncident.count(),
    db.securityIncident.count({ where: { status: { in: ['OPEN', 'INVESTIGATING', 'CONTAINED'] } } }),
    db.securityIncident.count({ where: { affectsPersonalData: true } }),
    db.securityIncident.groupBy({ by: ['category'], _count: { _all: true } }),
    db.securityIncident.groupBy({ by: ['severity'], _count: { _all: true } }),
    db.securityIncident.findMany({ where: { resolvedAt: { not: null } }, select: { detectedAt: true, resolvedAt: true } }),
  ]);

  const mttrHours = resolved.length
    ? resolved.reduce((a, i) => a + (i.resolvedAt!.getTime() - i.detectedAt.getTime()) / 3600000, 0) / resolved.length
    : null;

  return {
    hasData: total > 0,
    total,
    open,
    affectsPersonalData: pii,
    mttrHours,
    byCategory: byCat.map((c) => ({ category: c.category, count: c._count._all })).sort((a, b) => b.count - a.count),
    bySeverity: bySev.map((s) => ({ severity: s.severity, count: s._count._all })),
  };
}

export interface AccountRiskRow { ref: string; score: number; reasons: string[] }

export async function getAccountRisk() {
  const [scores, run] = await Promise.all([
    db.riskScore.findMany({ where: { subjectType: 'USER' }, orderBy: { score: 'desc' } }),
    db.modelRun.findFirst({ where: { modelType: 'account_takeover' }, orderBy: { startedAt: 'desc' } }),
  ]);
  // Privacidad (Ley 21.719): no se expone email ni id completo, solo un
  // identificador pseudónimo corto para que el vendedor pueda correlacionar.
  const rows: AccountRiskRow[] = scores.map((s) => ({
    ref: s.subjectId.slice(-6),
    score: s.score,
    reasons: Array.isArray(s.reasons) ? (s.reasons as string[]) : [],
  }));
  const stuffingIps = run && run.metrics && typeof run.metrics === 'object' && 'ips_stuffing' in run.metrics
    ? Number((run.metrics as Record<string, unknown>)['ips_stuffing']) : 0;
  return {
    hasData: rows.length > 0,
    lastUpdated: run?.finishedAt ?? null,
    flagged: rows.length,
    stuffingIps,
    rows,
  };
}

export interface SegmentRow { segment: string; count: number; avgR: number; avgF: number; avgM: number }

export async function getCustomerSegments() {
  const [grouped, run, total] = await Promise.all([
    db.customerSegment.groupBy({
      by: ['segment'],
      _count: { _all: true },
      _avg: { rScore: true, fScore: true, mScore: true },
    }),
    db.modelRun.findFirst({ where: { modelType: 'rfm' }, orderBy: { startedAt: 'desc' } }),
    db.customerSegment.count(),
  ]);
  const segments: SegmentRow[] = grouped
    .map((g) => ({ segment: g.segment, count: g._count._all, avgR: g._avg.rScore ?? 0, avgF: g._avg.fScore ?? 0, avgM: g._avg.mScore ?? 0 }))
    .sort((a, b) => b.count - a.count);
  return {
    hasData: total > 0,
    lastUpdated: run?.finishedAt ?? null,
    total,
    silhouette: metric(run?.metrics, 'silhouette'),
    segments,
  };
}

// ── Ampliaciones: tendencias, mermas, sobre-stock, bundles, anomalías,
//    logística, recompra/churn, alertas. Todo BI de solo lectura. ──────────

const n = (v: unknown) => Number(v ?? 0);

export interface TrendRow { name: string; recent: number; prior: number; growth: number }
export async function getProductTrends() {
  const rows = await db.$queryRaw<{ name: string; recent: bigint; prior: bigint }[]>`
    SELECT p.name,
      SUM(CASE WHEN o."createdAt" >= now() - interval '90 days' THEN oi.quantity ELSE 0 END) AS recent,
      SUM(CASE WHEN o."createdAt" < now() - interval '90 days' AND o."createdAt" >= now() - interval '180 days' THEN oi.quantity ELSE 0 END) AS prior
    FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" JOIN "Product" p ON p.id = oi."productId"
    WHERE o."paymentStatus" = 'PAID' GROUP BY p.name`;
  const all: TrendRow[] = rows.map((r) => {
    const recent = n(r.recent), prior = n(r.prior);
    return { name: r.name, recent, prior, growth: prior > 0 ? (recent - prior) / prior : recent > 0 ? 1 : 0 };
  });
  return {
    hasData: all.length > 0,
    rising: [...all].filter((r) => r.growth > 0.1).sort((a, b) => b.growth - a.growth).slice(0, 6),
    declining: [...all].filter((r) => r.growth < -0.1).sort((a, b) => a.growth - b.growth).slice(0, 6),
  };
}

export interface ShrinkageRow { name: string; reason: string; qty: number; cost: number }
export async function getShrinkage() {
  const rows = await db.$queryRaw<{ name: string; reason: string; qty: bigint; cost: bigint }[]>`
    SELECT p.name, sm.reason::text AS reason, SUM(sm.quantity) AS qty, SUM(sm.quantity * COALESCE(p."costCLP", 0)) AS cost
    FROM "StockMovement" sm JOIN "Product" p ON p.id = sm."productId"
    WHERE sm.reason IN ('DAMAGED', 'EXPIRED') GROUP BY p.name, sm.reason ORDER BY cost DESC`;
  const items: ShrinkageRow[] = rows.map((r) => ({ name: r.name, reason: r.reason, qty: n(r.qty), cost: n(r.cost) }));
  return {
    hasData: items.length > 0,
    items,
    totalUnits: items.reduce((a, i) => a + i.qty, 0),
    totalCost: items.reduce((a, i) => a + i.cost, 0),
  };
}

export interface DeadStockRow { name: string; stock: number; sold90: number; immobilized: number }
export async function getDeadStock() {
  const rows = await db.$queryRaw<{ name: string; stock: number; cost: number; sold90: bigint }[]>`
    SELECT p.name, p.stock, COALESCE(p."costCLP", 0) AS cost,
      COALESCE(SUM(CASE WHEN o."createdAt" >= now() - interval '90 days' AND o."paymentStatus" = 'PAID' THEN oi.quantity END), 0) AS sold90
    FROM "Product" p
    LEFT JOIN "OrderItem" oi ON oi."productId" = p.id
    LEFT JOIN "Order" o ON o.id = oi."orderId"
    WHERE p.active = true GROUP BY p.id, p.name, p.stock, p."costCLP"`;
  const items: DeadStockRow[] = rows
    .map((r) => ({ name: r.name, stock: r.stock, sold90: n(r.sold90), immobilized: r.stock * n(r.cost) }))
    .filter((r) => r.stock > 0 && r.sold90 <= r.stock * 0.15)
    .sort((a, b) => b.immobilized - a.immobilized)
    .slice(0, 10);
  return { hasData: items.length > 0, items, totalImmobilized: items.reduce((a, i) => a + i.immobilized, 0) };
}

export interface BundleRow { a: string; b: string; score: number; price: number }
export async function getBundles() {
  const recs = await db.productRecommendation.findMany({
    where: { strategy: 'BASKET' },
    orderBy: { score: 'desc' },
    include: { product: { select: { name: true, priceCLP: true } }, recommended: { select: { name: true, priceCLP: true } } },
  });
  const seen = new Set<string>();
  const bundles: BundleRow[] = [];
  for (const r of recs) {
    const key = [r.productId, r.recommendedProductId].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    bundles.push({ a: r.product.name, b: r.recommended.name, score: r.score, price: r.product.priceCLP + r.recommended.priceCLP });
    if (bundles.length >= 8) break;
  }
  return { hasData: bundles.length > 0, bundles };
}

export interface SalesAnomaly { date: Date; revenue: number; expected: number; deviation: number }
export async function getSalesAnomalies() {
  const rows = await db.$queryRaw<{ d: Date; rev: bigint }[]>`
    SELECT date_trunc('day', o."createdAt") AS d, SUM(oi."unitPriceCLP" * oi.quantity) AS rev
    FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
    WHERE o."paymentStatus" = 'PAID' AND o."createdAt" >= now() - interval '180 days'
    GROUP BY 1 ORDER BY 1`;
  const series = rows.map((r) => ({ date: r.d, rev: n(r.rev) }));
  if (series.length < 10) return { hasData: false, anomalies: [] as SalesAnomaly[] };
  const mean = series.reduce((a, s) => a + s.rev, 0) / series.length;
  const std = Math.sqrt(series.reduce((a, s) => a + (s.rev - mean) ** 2, 0) / series.length) || 1;
  const anomalies = series
    .filter((s) => Math.abs((s.rev - mean) / std) >= 2.5)
    .map((s) => ({ date: s.date, revenue: s.rev, expected: mean, deviation: (s.rev - mean) / std }))
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
    .slice(0, 8);
  return { hasData: anomalies.length > 0, anomalies, mean };
}

export interface RegionRow { region: string; revenue: number; orders: number; avgShipping: number; shipPct: number }
export interface CourierRow { method: string; delivered: number; avgDays: number }
export async function getLogistics() {
  const regionRows = await db.$queryRaw<{ region: string; revenue: bigint; orders: bigint; ship: bigint }[]>`
    SELECT COALESCE(o."shippingRegion", 'Retiro en tienda') AS region,
      SUM(o."subtotalCLP") AS revenue, COUNT(*) AS orders, SUM(o."shippingCLP") AS ship
    FROM "Order" o WHERE o."paymentStatus" = 'PAID' GROUP BY 1 ORDER BY revenue DESC`;
  const byRegion: RegionRow[] = regionRows.map((r) => {
    const revenue = n(r.revenue), ship = n(r.ship);
    return { region: r.region, revenue, orders: n(r.orders), avgShipping: n(r.orders) ? ship / n(r.orders) : 0, shipPct: revenue ? ship / revenue : 0 };
  });
  const courierRows = await db.$queryRaw<{ method: string; delivered: bigint; avg_days: number }[]>`
    SELECT o."shippingMethod"::text AS method, COUNT(*) AS delivered,
      AVG(EXTRACT(EPOCH FROM (o."deliveredAt" - o."createdAt")) / 86400) AS avg_days
    FROM "Order" o WHERE o."deliveredAt" IS NOT NULL GROUP BY 1 ORDER BY delivered DESC`;
  const byCourier: CourierRow[] = courierRows.map((r) => ({ method: r.method, delivered: n(r.delivered), avgDays: Number(r.avg_days ?? 0) }));
  return { hasData: byRegion.length > 0, byRegion, byCourier };
}

export interface RepeatChurn {
  hasData: boolean;
  activeCustomers: number;
  atRisk: number;
  dueSoon: number;
  avgIntervalDays: number;
}
export async function getRepeatChurn(): Promise<RepeatChurn> {
  const rows = await db.$queryRaw<{ user_id: string; orders: bigint; first: Date; last: Date }[]>`
    SELECT "userId" AS user_id, COUNT(*) AS orders, MIN("createdAt") AS first, MAX("createdAt") AS last
    FROM "Order" WHERE "paymentStatus" = 'PAID' GROUP BY "userId" HAVING COUNT(*) >= 2`;
  if (rows.length === 0) return { hasData: false, activeCustomers: 0, atRisk: 0, dueSoon: 0, avgIntervalDays: 0 };
  const now = Date.now();
  let atRisk = 0, dueSoon = 0, intervalSum = 0;
  for (const r of rows) {
    const span = (r.last.getTime() - r.first.getTime()) / 86400000;
    const interval = span / (n(r.orders) - 1);
    intervalSum += interval;
    const daysSinceLast = (now - r.last.getTime()) / 86400000;
    if (daysSinceLast > interval * 2 && daysSinceLast > 60) atRisk++;
    else if (daysSinceLast >= interval * 0.8) dueSoon++;
  }
  return {
    hasData: true,
    activeCustomers: rows.length,
    atRisk,
    dueSoon,
    avgIntervalDays: intervalSum / rows.length,
  };
}

export interface Alert { level: 'critical' | 'warning' | 'info'; message: string }
export async function getAlerts(): Promise<Alert[]> {
  const [lowStock, urgentRestock, criticalIncidents, riskyOrders, attackedAccounts] = await Promise.all([
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM "Product" WHERE active = true AND stock <= "lowStockThreshold"`,
    db.restockSuggestion.count({ where: { score: { gte: 0.5 } } }),
    db.securityIncident.count({ where: { severity: 'CRITICAL', status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
    db.riskScore.count({ where: { subjectType: 'ORDER' } }),
    db.riskScore.count({ where: { subjectType: 'USER' } }),
  ]);
  const alerts: Alert[] = [];
  const low = n(lowStock[0]?.c);
  if (criticalIncidents > 0) alerts.push({ level: 'critical', message: `${criticalIncidents} incidente(s) de seguridad crítico(s) sin resolver` });
  if (attackedAccounts > 0) alerts.push({ level: 'critical', message: `${attackedAccounts} cuenta(s) bajo ataque detectadas` });
  if (urgentRestock > 0) alerts.push({ level: 'warning', message: `${urgentRestock} producto(s) con reposición urgente` });
  if (low > 0) alerts.push({ level: 'warning', message: `${low} producto(s) en o bajo el umbral de stock` });
  if (riskyOrders > 0) alerts.push({ level: 'info', message: `${riskyOrders} orden(es) marcadas para revisión de fraude` });
  return alerts;
}
