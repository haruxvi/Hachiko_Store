import type { NextRequest } from 'next/server';
import { db } from '@/src/lib/db';
import { getSellerOrderDetail } from '@/src/lib/services/order.service';
import { shippingLabel, trackingUrlFor } from '@/src/lib/shipping';
import { api, ApiError, limit, ok, options, requireSession } from '@/src/lib/api/v1';

export { options as OPTIONS };

const ID = /^[A-Za-z0-9-]{1,64}$/;

// Ficha de despacho: solo lo necesario para empacar y etiquetar (Ley 21.719).
export const GET = api<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller', 120, 60_000, session.sub);
  const { id } = await params;
  if (!ID.test(id)) throw new ApiError(404, 'NOT_FOUND', 'No encontramos ese pedido.');

  const order = await getSellerOrderDetail(id);
  if (!order) throw new ApiError(404, 'NOT_FOUND', 'No encontramos ese pedido.');
  const risk = await db.riskScore.findFirst({ where: { subjectType: 'ORDER', subjectId: id }, select: { score: true, reasons: true } });

  return ok({
    ...order,
    isPickup: order.shippingMethod === 'PICKUP',
    shippingLabel: shippingLabel(order.shippingMethod),
    trackingUrl: trackingUrlFor(order.shippingMethod, order.trackingNumber),
    canShip: order.status === 'PAID' || order.status === 'PREPARING',
    risk: risk ? { score: risk.score, reasons: Array.isArray(risk.reasons) ? (risk.reasons as string[]) : [] } : null,
  });
});
