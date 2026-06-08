import { redirect } from 'next/navigation';
import { getSession } from '@/src/lib/auth/session';
import { getClientOrders } from '@/src/lib/services/order.service';

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
          {orders.map((o) => (
            <div key={o.id} className="border rounded-xl p-5">
              <div className="flex justify-between mb-3">
                <p className="font-bold">Orden #{o.orderNumber}</p>
                <span className="text-sm text-gray-500">
                  {new Date(o.createdAt).toLocaleDateString('es-CL')}
                </span>
              </div>
              <div className="text-sm text-gray-600 mb-2">
                {o.items.map((i, idx) => (
                  <span key={idx}>{i.quantity}× {i.productName}{idx < o.items.length - 1 ? ', ' : ''}</span>
                ))}
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  o.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                  o.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                  o.status === 'PAID' ? 'bg-yellow-100 text-yellow-700' :
                  o.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {o.status}
                </span>
                <p className="font-bold">${o.totalCLP.toLocaleString('es-CL')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
