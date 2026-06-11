import { getSession } from '@/src/lib/auth/session';
import { getOrdersForSeller } from '@/src/lib/services/order.service';
import { shippingLabel, SHIPPING_METHODS } from '@/src/lib/shipping';
import ShipOrderForm from '@/src/components/panel/ShipOrderForm';

export default async function OrdenesPage() {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const orders = await getOrdersForSeller();

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Órdenes para despachar</h1>
      {orders.length === 0 ? (
        <p className="text-gray-400">No hay órdenes pagadas pendientes de despacho.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {orders.map((o) => {
            const isPickup = !SHIPPING_METHODS[o.shippingMethod].requiresAddress;
            return (
              <div key={o.orderNumber} className="border rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-bold">Orden #{o.orderNumber}</p>
                    <p className="text-sm text-gray-500">{new Date(o.createdAt).toLocaleDateString('es-CL')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* El método que eligió el cliente manda: define qué se muestra y cómo se despacha */}
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {shippingLabel(o.shippingMethod)}
                    </span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      o.status === 'PAID' ? 'bg-yellow-100 text-yellow-700' :
                      o.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {o.status}
                    </span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-1">
                      {isPickup ? 'Retira en tienda' : 'Destinatario'}
                    </p>
                    <p className="text-sm">{o.recipientName}</p>
                    {!isPickup && (
                      <>
                        <p className="text-sm">{o.shippingStreet} {o.shippingNumber}{o.shippingApartment ? `, ${o.shippingApartment}` : ''}</p>
                        <p className="text-sm">{o.shippingCommune}, {o.shippingRegion}</p>
                      </>
                    )}
                    <p className="text-sm">{o.shippingPhone}</p>
                    {o.shippingNotes && <p className="text-xs text-gray-500 mt-1">{o.shippingNotes}</p>}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Productos</p>
                    {o.items.map((item, i) => (
                      <p key={i} className="text-sm">{item.quantity}× {item.name}</p>
                    ))}
                  </div>
                </div>

                {o.status === 'PAID' && (
                  <ShipOrderForm
                    orderId={o.id}
                    carrierLabel={shippingLabel(o.shippingMethod)}
                    isPickup={isPickup}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
