import type { NextRequest } from 'next/server';
import { getProducts, type ProductSort } from '@/src/lib/services/catalog.service';
import { getAvailableStockBatch } from '@/src/lib/services/inventory.service';
import { parseOption, parsePage, parseQuery } from '@/src/lib/panel-list';
import { productCard, siteOrigin } from '@/src/lib/api/dto';
import { api, limit, ok, options } from '@/src/lib/api/v1';

export { options as OPTIONS };

const SORTS = ['recent', 'price-asc', 'price-desc'] as const satisfies readonly ProductSort[];
const SIZES = ['12', '24', '48'] as const;

// Vitrina: búsqueda, categoría, orden, solo disponibles y paginación.
// Todos los parámetros pasan por listas permitidas (nada llega crudo a la base).
export const GET = api(async (req: NextRequest) => {
  await limit(req, 'catalog', 120, 60_000);
  const sp = req.nextUrl.searchParams;
  const q = parseQuery(sp.get('q') ?? undefined);
  const category = /^[a-z0-9-]{1,64}$/.test(sp.get('categoria') ?? '') ? sp.get('categoria')! : undefined;
  const sort = parseOption(sp.get('orden') ?? undefined, SORTS, 'recent');
  const perPage = Number(parseOption(sp.get('mostrar') ?? undefined, SIZES, '24'));
  const page = parsePage(sp.get('pagina') ?? undefined);

  const r = await getProducts({
    search: q || undefined,
    categorySlug: category,
    sort,
    inStockOnly: sp.get('stock') === '1',
    page,
    limit: perPage,
  });
  const available = await getAvailableStockBatch(r.products.map((p) => p.id));
  const base = siteOrigin(req.url);
  return ok({
    items: r.products.map((p) => productCard(p, base, available.get(p.id) ?? p.stock)),
    page: r.page,
    totalPages: Math.max(1, r.totalPages),
    total: r.total,
  });
});
