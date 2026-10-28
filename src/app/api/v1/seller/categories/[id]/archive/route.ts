import type { NextRequest } from 'next/server';
import { archiveCategoryAs } from '@/src/lib/catalog-admin';
import { api, limit, ok, options, requireSession, routeId, settled } from '@/src/lib/api/v1';

export { options as OPTIONS };

// Archivar: la categoría deja de mostrarse en la tienda; se puede restaurar.
export const POST = api<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller-write', 30, 60_000, session.sub);
  return ok(settled(await archiveCategoryAs(routeId((await params).id, 'No encontramos esa categoría.'))));
});
