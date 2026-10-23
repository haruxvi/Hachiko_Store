import type { NextRequest } from 'next/server';
import { archiveProductAs } from '@/src/lib/catalog-admin';
import { api, limit, ok, options, requireSession, routeId, settled } from '@/src/lib/api/v1';

export { options as OPTIONS };

// Archivar: el producto deja de venderse; su historial se conserva y se puede restaurar.
export const POST = api<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller-write', 30, 60_000, session.sub);
  return ok(settled(await archiveProductAs(routeId((await params).id, 'No encontramos ese producto.'))));
});
