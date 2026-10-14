import type { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { markOrderDelivered } from '@/src/lib/services/order.service';
import { api, ApiError, limit, ok, options, requireSession } from '@/src/lib/api/v1';

export { options as OPTIONS };

// Entregado por el courier o retirado en tienda: SHIPPED → DELIVERED.
export const POST = api<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller-write', 30, 60_000, session.sub);
  const { id } = await params;
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) throw new ApiError(404, 'NOT_FOUND', 'No encontramos ese pedido.');

  try {
    await markOrderDelivered(id, session.sub);
  } catch (e) {
    throw new ApiError(409, 'NOT_DELIVERABLE', e instanceof Error ? e.message : 'No se pudo actualizar el pedido.');
  }
  revalidatePath('/trastienda/ordenes');
  revalidatePath('/trastienda');
  return ok({ delivered: true });
});
