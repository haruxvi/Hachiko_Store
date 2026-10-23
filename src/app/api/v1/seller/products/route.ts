import type { NextRequest } from 'next/server';
import { listProductsForPanel, type PanelProductSort } from '@/src/lib/services/catalog.service';
import { createProductAs } from '@/src/lib/catalog-admin';
import { parseOption, parsePage, parsePageSize, parseQuery } from '@/src/lib/panel-list';
import { publicImages, siteOrigin } from '@/src/lib/api/dto';
import { api, jsonBody, limit, ok, options, requireSession, settled } from '@/src/lib/api/v1';

export { options as OPTIONS };

const SORTS = ['recientes', 'nombre', 'precio-asc', 'precio-desc', 'stock-asc'] as const satisfies readonly PanelProductSort[];

// Productos de la trastienda (incluye inactivos; archivados aparte), con
// búsqueda por nombre o SKU, categoría, orden y "Mostrar N". Alta con las
// mismas reglas del panel web (catalog-admin).
export const GET = api(async (req: NextRequest) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller', 120, 60_000, session.sub);
  const sp = req.nextUrl.searchParams;
  const categoria = sp.get('categoria') ?? '';
  const { info, items } = await listProductsForPanel({
    q: parseQuery(sp.get('q') ?? undefined),
    categoryId: /^[A-Za-z0-9-]{1,64}$/.test(categoria) ? categoria : undefined,
    status: parseOption(sp.get('estado') ?? undefined, ['activos', 'archivados'] as const, 'activos'),
    sort: parseOption(sp.get('orden') ?? undefined, SORTS, 'recientes'),
    page: parsePage(sp.get('pagina') ?? undefined),
    perPage: parsePageSize(sp.get('mostrar') ?? undefined),
  });
  const base = siteOrigin(req.url);
  return ok({
    page: info.page,
    totalPages: info.totalPages,
    total: info.total,
    items: items.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      nameKorean: p.nameKorean,
      category: p.category.name,
      image: publicImages(p.images, base)[0] ?? null,
      priceCLP: p.priceCLP,
      stock: p.stock,
      active: p.active,
      featured: p.featured,
      archived: p.archivedAt !== null,
    })),
  });
});

export const POST = api(async (req: NextRequest) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller-write', 30, 60_000, session.sub);
  return ok(settled(await createProductAs(await jsonBody(req, 32 * 1024))));
});
