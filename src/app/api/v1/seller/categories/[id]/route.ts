import type { NextRequest } from 'next/server';
import { db } from '@/src/lib/db';
import { updateCategoryAs } from '@/src/lib/catalog-admin';
import { api, ApiError, jsonBody, limit, ok, options, requireSession, routeId, settled } from '@/src/lib/api/v1';

export { options as OPTIONS };

const NOT_FOUND = 'No encontramos esa categoría.';

// Una categoría (para editarla) y su edición (mismas reglas que el panel web).
export const GET = api<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller', 120, 60_000, session.sub);
  const c = await db.category.findUnique({
    where: { id: routeId((await params).id, NOT_FOUND) },
    include: { _count: { select: { products: { where: { archivedAt: null } } } } },
  });
  if (!c) throw new ApiError(404, 'NOT_FOUND', NOT_FOUND);
  return ok({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    order: c.order,
    active: c.active,
    archived: c.archivedAt !== null,
    productCount: c._count.products,
  });
});

export const POST = api<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller-write', 30, 60_000, session.sub);
  const id = routeId((await params).id, NOT_FOUND);
  const body = await jsonBody(req);
  return ok(settled(await updateCategoryAs({ ...(body as object), id })));
});
