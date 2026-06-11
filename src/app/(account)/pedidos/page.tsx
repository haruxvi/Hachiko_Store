import { redirect } from 'next/navigation';
import { getSession } from '@/src/lib/auth/session';
import { getClientOrders } from '@/src/lib/services/order.service';
import { shippingLabel, trackingUrlFor } from '@/src/lib/shipping';
import CancelOrderButton from '@/src/components/storefront/CancelOrderButton';
import type { OrderStatus, ShippingMethod } from '@prisma/client';

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

  const orders = await getClientOrders(session.sub);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-8">Mis pedidos</h1>
      {orders.length === 0 ? (
        <p className="text-gray-400">No tienes pedidos aún.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((o) => {
            const trackingUrl = trackingUrlFor(o.shippingMethod, o.trackingNumber);
            const cancelled = o.status === 'CANCELLED';
            return (
              <div key={o.id} className="border rounded-xl p-5">
                <div className="flex justify-between mb-1">
                  <p className="font-bold">Pedido #{o.orderNumber}</p>
                  <span className="text-sm text-gray-500">
                    {new Date(o.createdAt).toLocaleDateString('es-CL')}
                  </span>
                </div>

                {/* Solo el método que el cliente eligió, nada más */}
                <p className="text-xs text-gray-500 mb-3">
                  Entrega: {shippingLabel(o.shippingMethod)}
                </p>

                <div className="text-sm text-gray-600 mb-4">
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
                              className={`w-3.5 h-3.5 rounded-full border-2 ${done ? 'bg-rose-500 border-rose-500' : 'bg-white border-gray-300'}`}
                              aria-hidden
                            />
                            <span className={`text-[11px] whitespace-nowrap ${done ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                              {step.label}
                            </span>
                          </span>
                          {idx < arr.length - 1 && (
                            <span
                              className={`h-0.5 flex-1 mx-1 mb-4 ${reached(o.status, arr[idx + 1]!.status) ? 'bg-rose-400' : 'bg-gray-200'}`}
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
                      o.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                      o.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                      o.status === 'PAID' ? 'bg-yellow-100 text-yellow-700' :
                      cancelled ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
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
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Seguir envío en {shippingLabel(o.shippingMethod)} →
                      </a>
                    )}
                    {o.status === 'PENDING' && <CancelOrderButton orderId={o.id} />}
                  </div>
                  <p className="font-bold">${o.totalCLP.toLocaleString('es-CL')}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
