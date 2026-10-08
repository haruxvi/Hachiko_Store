// Búsqueda, filtros y paginación de las listas del panel (productos, pedidos,
// categorías, inventario). Funciones puras: las usan las páginas en el servidor y
// los tests. El estado vive en la URL (?q=&pagina=&mostrar=…), así recargar,
// volver atrás o compartir el link conserva lo que se estaba mirando.

export const PAGE_SIZES = [10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 20;

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Toma el primer valor si el parámetro vino repetido (?q=a&q=b). */
export function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Texto de búsqueda: sin espacios sobrantes y acotado (no se busca un libro entero). */
export function parseQuery(v: string | string[] | undefined): string {
  return (one(v) ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);
}

export function parsePageSize(v: string | string[] | undefined): PageSize {
  const n = Number(one(v));
  return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : DEFAULT_PAGE_SIZE;
}

export function parsePage(v: string | string[] | undefined): number {
  const n = Math.floor(Number(one(v)));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 10_000) : 1;
}

/** Solo valores de una lista permitida: lo demás (o un valor manipulado) cae al valor por defecto. */
export function parseOption<T extends string>(v: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const s = one(v);
  return s !== undefined && (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

export interface PageInfo {
  page: number;
  totalPages: number;
  skip: number;
  take: number;
  /** Rango visible (1-based) para "Mostrando 21–40 de 57". 0–0 si no hay resultados. */
  from: number;
  to: number;
  total: number;
}

/** Si la página pedida ya no existe (p. ej. tras filtrar), se ajusta a la última. */
export function paginate(total: number, page: number, perPage: number): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), totalPages);
  const skip = (current - 1) * perPage;
  return {
    page: current,
    totalPages,
    skip,
    take: perPage,
    from: total === 0 ? 0 : skip + 1,
    to: Math.min(skip + perPage, total),
    total,
  };
}

/**
 * Conteo y página en paralelo (un solo viaje a la base). Si la página pedida
 * quedó fuera de rango (p. ej. ?pagina=9 tras filtrar), se pide la última.
 */
export async function fetchPage<T>(
  page: number,
  perPage: number,
  count: () => Promise<number>,
  fetch: (skip: number, take: number) => Promise<T[]>,
): Promise<{ info: PageInfo; items: T[] }> {
  const requestedSkip = (Math.max(1, page) - 1) * perPage;
  const [total, items] = await Promise.all([count(), fetch(requestedSkip, perPage)]);
  const info = paginate(total, page, perPage);
  if (info.skip !== requestedSkip) return { info, items: await fetch(info.skip, info.take) };
  return { info, items };
}

/** Números de página a mostrar, con "…" cuando hay muchas: 1 … 4 5 6 … 20. */
export function pageWindow(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push('…');
    out.push(p);
  });
  return out;
}

/** Arma un link conservando los parámetros actuales; los vacíos no ensucian la URL. */
export function hrefWith(
  path: string,
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined> = {},
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...overrides })) {
    if (v !== undefined && v !== '') q.set(k, v);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** Comparación sin mayúsculas ni tildes ("lapiz" encuentra "Lápiz"), para filtrar en memoria. */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function matchesQuery(q: string, ...fields: (string | number | null | undefined)[]): boolean {
  if (!q) return true;
  const needle = normalizeText(q);
  return fields.some((f) => f !== null && f !== undefined && normalizeText(String(f)).includes(needle));
}
