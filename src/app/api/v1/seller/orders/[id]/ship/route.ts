import type { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { markOrderShipped } from '@/src/lib/services/order.service';
import { api, ApiError, jsonBody, limit, ok, options, parse, requireSession } from '@/src/lib/api/v1';

export { options as OPTIONS };

const Body = z.object({ trackingNumber: z.string().trim().max(100).optional() });

// Marca la orden como enviada (o lista para retiro). El servicio impide
// despachar dos veces o despachar una orden cancelada, y avisa al cliente por correo.
export const POST = api<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller-write', 30, 60_000, session.sub);
  const { id } = await params;
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) throw new ApiError(404, 'NOT_FOUND', 'No encontramos ese pedido.');
  const { trackingNumber } = parse(Body, await jsonBody(req));

  try {
    await markOrderShipped(id, trackingNumber || null, session.sub, 'SELLER');
  } catch (e) {
    const already = e instanceof Error && e.message.startsWith('Esta orden ya fue despachada');
    throw new ApiError(409, already ? 'ALREADY_SHIPPED' : 'SHIP_FAILED', already ? e.message : 'No se pudo marcar como enviada. Inténtalo de nuevo.');
  }
  revalidatePath('/trastienda/ordenes');
  revalidatePath('/trastienda');
  return ok({ shipped: true });
});
