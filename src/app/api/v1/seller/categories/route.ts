import type { NextRequest } from 'next/server';
import { listCategoriesForPanel } from '@/src/lib/services/catalog.service';
import { createCategoryAs } from '@/src/lib/catalog-admin';
import { parseOption, parsePage, parsePageSize, parseQuery } from '@/src/lib/panel-list';
import { api, jsonBody, limit, ok, options, requireSession, settled } from '@/src/lib/api/v1';

export { options as OPTIONS };

// Categorías del catálogo (trastienda): listado con búsqueda, activas/archivadas
// y "Mostrar N"; alta con las mismas reglas del panel web (catalog-admin).
export const GET = api(async (req: NextRequest) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller', 120, 60_000, session.sub);
  const sp = req.nextUrl.searchParams;
  const { info, items } = await listCategoriesForPanel({
    q: parseQuery(sp.get('q') ?? undefined),
    archived: parseOption(sp.get('estado') ?? undefined, ['activas', 'archivadas'] as const, 'activas') === 'archivadas',
    page: parsePage(sp.get('pagina') ?? undefined),
    perPage: parsePageSize(sp.get('mostrar') ?? undefined),
  });
  return ok({
    page: info.page,
    totalPages: info.totalPages,
    total: info.total,
    items: items.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      order: c.order,
      active: c.active,
      archived: c.archivedAt !== null,
      productCount: c._count.products,
    })),
  });
});

export const POST = api(async (req: NextRequest) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller-write', 30, 60_000, session.sub);
  return ok(settled(await createCategoryAs(await jsonBody(req))));
});
