import type { NextRequest } from 'next/server';
import { getClientOrders } from '@/src/lib/services/order.service';
import { shippingLabel, trackingUrlFor } from '@/src/lib/shipping';
import { paginate, parsePage, parsePageSize } from '@/src/lib/panel-list';
import { api, limit, ok, options, requireSession } from '@/src/lib/api/v1';

export { options as OPTIONS };

// "Mis pedidos": estado, línea de tiempo y seguimiento. Sin datos de despacho
// cifrados (dirección, teléfono): la app no los necesita para mostrar el estado.
// Con ?pagina= responde por páginas ("Mostrar N" como el panel); sin él, la
// lista de los últimos 50 de siempre (la usa el Inicio y las versiones previas).
export const GET = api(async (req: NextRequest) => {
  const session = await requireSession(req);
  await limit(req, 'me', 60, 60_000, session.sub);
  const sp = req.nextUrl.searchParams;
  const orders = await getClientOrders(session.sub);
  const toDto = (list: typeof orders) =>
    list.map((o) => ({
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
    }));

  if (!sp.has('pagina')) return ok(toDto(orders.slice(0, 50)));
  const info = paginate(orders.length, parsePage(sp.get('pagina') ?? undefined), parsePageSize(sp.get('mostrar') ?? undefined));
  return ok({ items: toDto(orders.slice(info.skip, info.skip + info.take)), page: info.page, totalPages: info.totalPages, total: info.total });
});
