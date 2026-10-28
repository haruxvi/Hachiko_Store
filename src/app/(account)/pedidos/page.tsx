import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/src/lib/auth/session';
import { getClientOrders } from '@/src/lib/services/order.service';
import { getClientReturns, returnWindows } from '@/src/lib/services/returns.service';
import { pickupDeadline } from '@/src/lib/services/pickup.service';
import { shippingLabel, trackingUrlFor } from '@/src/lib/shipping';
import CancelOrderButton from '@/src/components/storefront/CancelOrderButton';
import type { OrderStatus, ReturnResolution, ReturnStatus, ShippingMethod } from '@prisma/client';

const RETURN_STATUS: Record<ReturnStatus, string> = {
  REQUESTED: 'En revisión',
  APPROVED: 'Aprobada: entréganos el producto',
  RECEIVED: 'Recibimos el producto',
  RESOLVED: 'Resuelta',
  REJECTED: 'No aprobada',
};
const RESOLUTION_LABEL: Record<ReturnResolution, string> = {
  EXCHANGE: 'Cambio',
  REFUND: 'Devolución del dinero',
  REPAIR: 'Reparación',
};
const shortDate = (d: Date) => d.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'long' });

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pendiente de pago',
  PAID: 'Pago confirmado',
  PREPARING: 'Preparando',
  SHIPPED: 'Despachado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

// Línea de tiempo del pedido. Para retiro en tienda, "Despachado" significa
// "Listo para retiro": siempre se habla en los términos del método elegido.
function timelineSteps(method: ShippingMethod): { status: OrderStatus; label: string }[] {
  return [
    { status: 'PAID', label: 'Pago confirmado' },
    { status: 'SHIPPED', label: method === 'PICKUP' ? 'Listo para retiro' : 'Despachado' },
    { status: 'DELIVERED', label: method === 'PICKUP' ? 'Retirado' : 'Entregado' },
  ];
}

const STATUS_ORDER: OrderStatus[] = ['PENDING', 'PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'];

function reached(current: OrderStatus, step: OrderStatus): boolean {
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(step);
}

export default async function PedidosPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [orders, returnsByOrder] = await Promise.all([getClientOrders(session.sub), getClientReturns(session.sub)]);
  const now = new Date();

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-8">Mis pedidos</h1>
      {orders.length === 0 ? (
        <p className="text-taupe">No tienes pedidos aún.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((o) => {
            const trackingUrl = trackingUrlFor(o.shippingMethod, o.trackingNumber);
            const cancelled = o.status === 'CANCELLED';
            const returns = returnsByOrder.get(o.id) ?? [];
            const openReturn = returns.find((r) => r.status === 'REQUESTED' || r.status === 'APPROVED' || r.status === 'RECEIVED');
            const receivedAt = o.deliveredAt ?? o.shippedAt;
            const windows = receivedAt ? returnWindows(receivedAt, now) : null;
            // Unidades ya incluidas en solicitudes (las rechazadas se pueden volver a pedir).
            const unitsInReturns = returns
              .filter((r) => r.status !== 'REJECTED')
              .reduce((a, r) => a + r.items.reduce((b, it) => b + it.quantity, 0), 0);
            const unitsBought = o.items.reduce((a, it) => a + it.quantity, 0);
            const canRequestReturn =
              o.status === 'DELIVERED' &&
              o.paymentStatus === 'PAID' &&
              !openReturn &&
              unitsInReturns < unitsBought &&
              Boolean(windows?.GARANTIA.open);
            const pickupUntil = o.shippingMethod === 'PICKUP' && o.status === 'SHIPPED' && o.shippedAt ? pickupDeadline(o.shippedAt) : null;
            return (
              <div key={o.id} className="border rounded-xl p-5">
                <div className="flex justify-between mb-1">
                  <p className="font-bold">Pedido #{o.orderNumber}</p>
                  <span className="text-sm text-taupe">
                    {new Date(o.createdAt).toLocaleDateString('es-CL')}
                  </span>
                </div>

                {/* Solo el método que el cliente eligió, nada más */}
                <p className="text-xs text-taupe mb-3">
                  Entrega: {shippingLabel(o.shippingMethod)}
                </p>

                <div className="text-sm text-taupe mb-4">
                  {o.items.map((i, idx) => (
                    <span key={idx}>{i.quantity}× {i.productName}{idx < o.items.length - 1 ? ', ' : ''}</span>
                  ))}
                </div>

                {/* Línea de tiempo (oculta si fue cancelado) */}
                {!cancelled && (
                  <ol className="flex items-center gap-0 mb-4" aria-label="Estado del pedido">
                    {timelineSteps(o.shippingMethod).map((step, idx, arr) => {
                      const done = reached(o.status, step.status);
                      return (
                        <li key={step.status} className="flex items-center flex-1 last:flex-none">
                          <span className="flex flex-col items-center gap-1">
                            <span
                              className={`w-3.5 h-3.5 rounded-full border-2 ${done ? 'bg-rust border-rust' : 'bg-white border-sand'}`}
                              aria-hidden
                            />
                            <span className={`text-[11px] whitespace-nowrap ${done ? 'text-soot font-medium' : 'text-taupe'}`}>
                              {step.label}
                            </span>
                          </span>
                          {idx < arr.length - 1 && (
                            <span
                              className={`h-0.5 flex-1 mx-1 mb-4 ${reached(o.status, arr[idx + 1]!.status) ? 'bg-rust' : 'bg-sand'}`}
                              aria-hidden
                            />
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      o.status === 'DELIVERED' ? 'bg-mint text-mint-ink' :
                      o.status === 'SHIPPED' ? 'bg-sky text-sky-ink' :
                      o.status === 'PAID' ? 'bg-butter text-rust-ink' :
                      cancelled ? 'bg-alert/[0.12] text-alert' :
                      'bg-sand text-taupe'
                    }`}>
                      {o.status === 'SHIPPED' && o.shippingMethod === 'PICKUP'
                        ? 'Listo para retiro'
                        : STATUS_LABEL[o.status]}
                    </span>
                    {trackingUrl && (
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-rust-ink hover:underline"
                      >
                        Seguir envío en {shippingLabel(o.shippingMethod)} →
                      </a>
                    )}
                    {o.status === 'PENDING' && <CancelOrderButton orderId={o.id} />}
                  </div>
                  <p className="font-bold">${o.totalCLP.toLocaleString('es-CL')}</p>
                </div>

                {pickupUntil && (
                  <p className="mt-3 text-[13px] text-soot">
                    Retíralo en la tienda (Recoleta) hasta el <strong>{shortDate(pickupUntil)}</strong>.
                  </p>
                )}

                {cancelled && o.paymentStatus === 'REFUND_PENDING' && (
                  <p className="mt-3 text-[13px] text-soot">
                    Te devolveremos el pago completo por el mismo medio con que pagaste. Te avisamos por correo cuando esté hecho.
                  </p>
                )}
                {cancelled && o.paymentStatus === 'REFUNDED' && (
                  <p className="mt-3 text-[13px] text-soot">Te devolvimos el pago completo por el mismo medio con que pagaste.</p>
                )}

                {/* Solicitudes de cambio o devolución */}
                {returns.map((r) => (
                  <div key={r.requestNumber} className="mt-3 rounded-lg border border-sand bg-cream px-4 py-3 text-[13px]">
                    <p className="text-soot">
                      <span className="font-semibold">Solicitud #{r.requestNumber}</span> · {RESOLUTION_LABEL[r.resolution]} ·{' '}
                      <span className={r.status === 'REJECTED' ? 'text-alert' : 'text-rust-ink'}>{RETURN_STATUS[r.status]}</span>
                    </p>
                    {r.sellerNote && (r.status === 'APPROVED' || r.status === 'REJECTED') && (
                      <p className="mt-1 whitespace-pre-line text-taupe">{r.sellerNote}</p>
                    )}
                    {r.status === 'RESOLVED' && r.refundCLP != null && (
                      <p className="mt-1 text-taupe">Te devolvimos ${r.refundCLP.toLocaleString('es-CL')}.</p>
                    )}
                  </div>
                ))}

                {canRequestReturn && windows && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-taupe">
                      {windows.RETRACTO.open
                        ? `Cambio o devolución hasta el ${shortDate(windows.RETRACTO.until)} · por falla, hasta el ${shortDate(windows.GARANTIA.until)}`
                        : `Garantía por falla hasta el ${shortDate(windows.GARANTIA.until)}`}
                    </p>
                    <Link href={`/pedidos/${o.id}/devolucion`} className="btn-outline btn-sm">
                      Solicitar cambio o devolución
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
