import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/src/lib/auth/session';
import { getProductSummary } from '@/src/lib/services/catalog.service';
import { getProductStockHistory } from '@/src/lib/services/inventory.service';

export const revalidate = 0;

export default async function HistoricoPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const { productId } = await params;

  const product = await getProductSummary(productId);

  if (!product) notFound();

  const movements = await getProductStockHistory(productId, 90);

  const reasonLabel: Record<string, string> = {
    SALE: 'Venta',
    RESTOCK: 'Reabastecimiento',
    CORRECTION_UP: 'Corrección ↑',
    CORRECTION_DOWN: 'Corrección ↓',
    DAMAGED: 'Mermado',
    EXPIRED: 'Vencido',
    RETURNED: 'Devolución',
    INITIAL_LOAD: 'Carga inicial',
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Link href="/trastienda/inventario" className="text-sm text-gray-400 hover:underline">
          ← Inventario
        </Link>
      </div>
      <h1 className="text-xl font-bold mb-1">{product.name}</h1>
      <p className="text-sm text-gray-400 mb-6">
        SKU: {product.sku} · Stock actual: {product.stock} uds.
      </p>

      {movements.length === 0 ? (
        <p className="text-sm text-gray-400">Sin movimientos en los últimos 90 días.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4 font-medium text-gray-500">Fecha</th>
              <th className="py-2 pr-4 font-medium text-gray-500">Tipo</th>
              <th className="py-2 pr-4 font-medium text-gray-500">Motivo</th>
              <th className="py-2 pr-4 font-medium text-gray-500 text-right">Cantidad</th>
              <th className="py-2 pr-4 font-medium text-gray-500 text-right">Anterior</th>
              <th className="py-2 pr-4 font-medium text-gray-500 text-right">Resultante</th>
              <th className="py-2 font-medium text-gray-500">Referencia</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-2 pr-4 text-gray-500 text-xs whitespace-nowrap">
                  {new Date(m.createdAt).toLocaleString('es-CL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      m.type === 'IN'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {m.type === 'IN' ? 'Entrada' : 'Salida'}
                  </span>
                </td>
                <td className="py-2 pr-4">{reasonLabel[m.reason] ?? m.reason}</td>
                <td className="py-2 pr-4 text-right font-mono">
                  <span className={m.quantity > 0 ? 'text-green-600' : 'text-red-600'}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </span>
                </td>
                <td className="py-2 pr-4 text-right font-mono text-gray-400">{m.previousStock}</td>
                <td className="py-2 pr-4 text-right font-mono font-medium">{m.resultingStock}</td>
                <td className="py-2 text-xs text-gray-400">
                  {m.order
                    ? `Orden #${m.order.orderNumber}`
                    : m.adjustment?.notes
                      ? m.adjustment.notes
                      : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
