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
