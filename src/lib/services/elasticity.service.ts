import { db } from '@/src/lib/db';
import { SALE_WHERE } from '@/src/lib/sales';

// Elasticidad-precio con datos REALES: cada cambio de precio queda en
// PriceHistory (lo registra updateProduct) y aquí se mide qué pasó con las
// ventas antes y después. Sin datos inventados: si todavía no hay ventas o días
// suficientes, se dice tal cual en vez de mostrar un número débil.
//
// Método: elasticidad de arco (punto medio) entre las unidades vendidas por día
// en una ventana antes del cambio y otra después. Es una medida descriptiva:
// no separa el efecto del precio de la estacionalidad, promociones u otros
// factores, y así se explica en la interfaz.

const DAY = 24 * 60 * 60 * 1000;
/** Largo máximo de cada ventana (antes y después del cambio). */
export const WINDOW_DAYS = 28;
/** Días mínimos en cada ventana para medir (el resto queda "en espera"). */
export const MIN_WINDOW_DAYS = 14;
/** Unidades mínimas sumando ambas ventanas para que la medida signifique algo. */
export const MIN_UNITS = 10;

export type PriceChange = { id: string; createdAt: Date; previousCLP: number; newCLP: number };
export type Sale = { at: Date; units: number };

export type Reading = 'elastic' | 'inelastic' | 'unit' | 'atypical';

export type ChangeEffect = PriceChange &
  (
    | {
        status: 'measured';
        priceChange: number; // fracción, p. ej. 0.10 = +10 %
        unitsPerDayBefore: number;
        unitsPerDayAfter: number;
        unitsChange: number; // fracción
        elasticity: number;
        reading: Reading;
      }
    | { status: 'pending'; daysLeft: number }
    | { status: 'insufficient'; reason: string }
  );

/** Variación porcentual de punto medio (simétrica: subir y bajar pesan igual). */
const midpointChange = (from: number, to: number) => (from + to === 0 ? 0 : (to - from) / ((from + to) / 2));

/** Elasticidad de arco: variación de cantidad / variación de precio (punto medio). */
export function arcElasticity(p0: number, p1: number, q0: number, q1: number): number {
  const dp = midpointChange(p0, p1);
  return dp === 0 ? 0 : midpointChange(q0, q1) / dp;
}

export function readingOf(e: number): Reading {
  if (e > 0.05) return 'atypical'; // las ventas se movieron en el mismo sentido que el precio
  const a = Math.abs(e);
  if (a > 1.1) return 'elastic';
  if (a < 0.9) return 'inelastic';
  return 'unit';
}

const unitsBetween = (sales: Sale[], from: number, to: number) =>
  sales.reduce((s, x) => (x.at.getTime() >= from && x.at.getTime() < to ? s + x.units : s), 0);

/**
 * Efecto de cada cambio de precio de un producto, del más reciente al más antiguo.
 * Las ventanas se cortan en el cambio anterior/siguiente para no mezclar precios.
 */
export function measureChanges(changes: PriceChange[], sales: Sale[], now: Date = new Date()): ChangeEffect[] {
  const asc = [...changes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return asc
    .map((c, i): ChangeEffect => {
      const t = c.createdAt.getTime();
      const prev = asc[i - 1]?.createdAt.getTime() ?? -Infinity;
      const next = asc[i + 1]?.createdAt.getTime() ?? Infinity;
      const beforeFrom = Math.max(t - WINDOW_DAYS * DAY, prev);
      const afterTo = Math.min(t + WINDOW_DAYS * DAY, next, now.getTime());
      const daysBefore = (t - beforeFrom) / DAY;
      const daysAfter = (afterTo - t) / DAY;

      if (c.previousCLP === c.newCLP) return { ...c, status: 'insufficient', reason: 'El precio no cambió.' };
      if (daysBefore < MIN_WINDOW_DAYS)
        return { ...c, status: 'insufficient', reason: `El precio anterior duró menos de ${MIN_WINDOW_DAYS} días.` };
      if (daysAfter < MIN_WINDOW_DAYS) {
        // Si lo cortó otro cambio, ya no se va a completar; si es el tiempo, sí.
        if (next < t + MIN_WINDOW_DAYS * DAY)
          return { ...c, status: 'insufficient', reason: `Hubo otro cambio de precio antes de ${MIN_WINDOW_DAYS} días.` };
        return { ...c, status: 'pending', daysLeft: Math.ceil(MIN_WINDOW_DAYS - daysAfter) };
      }

      const before = unitsBetween(sales, beforeFrom, t);
      const after = unitsBetween(sales, t, afterTo);
      if (before + after < MIN_UNITS)
        return { ...c, status: 'insufficient', reason: `Muy pocas ventas para medir (${before + after} unidades; se necesitan ${MIN_UNITS}).` };

      const q0 = before / daysBefore;
      const q1 = after / daysAfter;
      const elasticity = arcElasticity(c.previousCLP, c.newCLP, q0, q1);
      return {
        ...c,
        status: 'measured',
        priceChange: (c.newCLP - c.previousCLP) / c.previousCLP,
        unitsPerDayBefore: q0,
        unitsPerDayAfter: q1,
        unitsChange: q0 === 0 ? 0 : (q1 - q0) / q0,
        elasticity,
        reading: readingOf(elasticity),
      };
    })
    .reverse();
}

export const READING_LABEL: Record<Reading, string> = {
  elastic: 'Elástica: las ventas reaccionan más que el precio',
  inelastic: 'Inelástica: las ventas reaccionan menos que el precio',
  unit: 'Unitaria: ventas y precio se mueven en proporción',
  atypical: 'Atípica: las ventas se movieron en el mismo sentido que el precio (pesan otros factores)',
};

// ─── Lectura desde la base ────────────────────────────────────────────

async function salesOf(productIds: string[], since: Date) {
  if (productIds.length === 0) return new Map<string, Sale[]>();
  const items = await db.orderItem.findMany({
    where: { productId: { in: productIds }, order: { ...SALE_WHERE, createdAt: { gte: since } } },
    select: { productId: true, quantity: true, order: { select: { createdAt: true } } },
  });
  const map = new Map<string, Sale[]>();
  for (const i of items) {
    const list = map.get(i.productId) ?? [];
    list.push({ at: i.order.createdAt, units: i.quantity });
    map.set(i.productId, list);
  }
  return map;
}

/** Efecto de los cambios de precio de un producto (ficha del producto en el panel). */
export async function getProductElasticity(productId: string): Promise<ChangeEffect[]> {
  const changes = await db.priceHistory.findMany({
    where: { productId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true, previousCLP: true, newCLP: true },
  });
  if (changes.length === 0) return [];
  const since = new Date(changes[0]!.createdAt.getTime() - WINDOW_DAYS * DAY);
  const sales = (await salesOf([productId], since)).get(productId) ?? [];
  return measureChanges(changes, sales);
}

export type ElasticityOverview = {
  measured: { productId: string; name: string; sku: string; effect: Extract<ChangeEffect, { status: 'measured' }> }[];
  pending: number;
  insufficient: number;
  changes: number;
};

/** Resumen para Demanda: la medición más reciente de cada producto con cambios de precio. */
export async function getElasticityOverview(): Promise<ElasticityOverview> {
  const changes = await db.priceHistory.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, productId: true, createdAt: true, previousCLP: true, newCLP: true, product: { select: { name: true, sku: true } } },
  });
  const overview: ElasticityOverview = { measured: [], pending: 0, insufficient: 0, changes: changes.length };
  if (changes.length === 0) return overview;

  const byProduct = new Map<string, typeof changes>();
  for (const c of changes) byProduct.set(c.productId, [...(byProduct.get(c.productId) ?? []), c]);
  const since = new Date(changes[0]!.createdAt.getTime() - WINDOW_DAYS * DAY);
  const sales = await salesOf([...byProduct.keys()], since);

  for (const [productId, list] of byProduct) {
    const effects = measureChanges(list, sales.get(productId) ?? []);
    for (const e of effects) {
      if (e.status === 'pending') overview.pending++;
      if (e.status === 'insufficient') overview.insufficient++;
    }
    const latest = effects.find((e) => e.status === 'measured');
    if (latest && latest.status === 'measured')
      overview.measured.push({ productId, name: list[0]!.product.name, sku: list[0]!.product.sku, effect: latest });
  }
  // Primero lo más sensible al precio: ahí un cambio pesa más en las ventas.
  overview.measured.sort((a, b) => Math.abs(b.effect.elasticity) - Math.abs(a.effect.elasticity));
  return overview;
}
