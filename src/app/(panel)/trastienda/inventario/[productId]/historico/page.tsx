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
      <header className="mb-6">
        <Link
          href="/trastienda/inventario"
          className="text-[13px] font-medium text-taupe transition hover:text-soot hover:underline"
        >
          ← Inventario
        </Link>
        <h1 className="mt-2 font-display text-[34px] font-bold leading-[1.1] tracking-[-0.015em] text-soot">
          {product.name}
        </h1>
        <div className="editorial mt-1.5 text-[15px] leading-snug text-taupe">
          SKU {product.sku} — stock actual {product.stock} uds.
        </div>
      </header>

      {movements.length === 0 ? (
        <p className="text-sm text-taupe">Sin movimientos en los últimos 90 días.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-sand bg-snow">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-body text-sm">
              <thead>
                <tr className="bg-cream">
                  <th className="px-4 py-3 text-left text-xs font-medium text-taupe">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-taupe">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-taupe">Motivo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-taupe">Cantidad</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-taupe">Anterior</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-taupe">
                    Resultante
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-taupe">
                    Referencia
                  </th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-sand transition hover:bg-cream/60">
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-[13px] font-normal text-taupe">
                      {new Date(m.createdAt).toLocaleString('es-CL', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          m.type === 'IN' ? 'bg-mint text-mint-deep' : 'bg-alert/10 text-alert'
                        }`}
                      >
                        {m.type === 'IN' ? 'Entrada' : 'Salida'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-soot">
                      {reasonLabel[m.reason] ?? m.reason}
                    </td>
                    <td className="price-mono px-4 py-3 text-right align-middle text-[15px]">
                      <span className={m.quantity > 0 ? 'text-mint-deep' : 'text-alert'}>
                        {m.quantity > 0 ? '+' : ''}
                        {m.quantity}
                      </span>
                    </td>
                    <td className="price-mono px-4 py-3 text-right align-middle text-[15px] text-taupe">
                      {m.previousStock}
                    </td>
                    <td className="price-mono px-4 py-3 text-right align-middle text-[15px] font-medium text-soot">
                      {m.resultingStock}
                    </td>
                    <td className="px-4 py-3 align-middle text-[13px] font-normal text-taupe">
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
          </div>
        </div>
      )}
    </div>
  );
}
