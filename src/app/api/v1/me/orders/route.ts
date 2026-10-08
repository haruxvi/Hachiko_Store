import type { NextRequest } from 'next/server';
import { getClientOrders } from '@/src/lib/services/order.service';
import { shippingLabel, trackingUrlFor } from '@/src/lib/shipping';
import { api, limit, ok, options, requireSession } from '@/src/lib/api/v1';

export { options as OPTIONS };

// "Mis pedidos": estado, línea de tiempo y seguimiento. Sin datos de despacho
// cifrados (dirección, teléfono): la app no los necesita para mostrar el estado.
export const GET = api(async (req: NextRequest) => {
  const session = await requireSession(req);
  await limit(req, 'me', 60, 60_000, session.sub);
  const orders = await getClientOrders(session.sub);
  return ok(
    orders.slice(0, 50).map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      shippingMethod: o.shippingMethod,
      shippingLabel: shippingLabel(o.shippingMethod),
      trackingUrl: trackingUrlFor(o.shippingMethod, o.trackingNumber),
      totalCLP: o.totalCLP,
      createdAt: o.createdAt,
      shippedAt: o.shippedAt,
      deliveredAt: o.deliveredAt,
      items: o.items.map((i) => ({ name: i.productName, quantity: i.quantity, unitPriceCLP: i.unitPriceCLP })),
    })),
  );
});
