import type { NextRequest } from 'next/server';
import { restoreCategoryAs } from '@/src/lib/catalog-admin';
import { api, limit, ok, options, requireSession, routeId, settled } from '@/src/lib/api/v1';

export { options as OPTIONS };

// Restaurar una categoría archivada (vuelve a la tienda).
export const POST = api<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller-write', 30, 60_000, session.sub);
  return ok(settled(await restoreCategoryAs(routeId((await params).id, 'No encontramos esa categoría.'))));
});
