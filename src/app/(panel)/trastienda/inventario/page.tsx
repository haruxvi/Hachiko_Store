import Link from 'next/link';
import { getSession } from '@/src/lib/auth/session';
import { getInventoryMaster } from '@/src/lib/services/dashboard.service';
import StockAdjustPanel from '@/src/components/panel/StockAdjustPanel';

export const revalidate = 0;

export default async function InventarioPage() {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const products = await getInventoryMaster();
  const lowCount = products.filter((p) => p.isLowStock).length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.015em] text-soot">
          Inventario
        </h1>
        <div className="editorial mt-1.5 text-[15px] leading-snug text-taupe">
          {lowCount > 0
            ? `${lowCount} ${lowCount === 1 ? 'producto necesita' : 'productos necesitan'} reposición.`
            : 'Stock al día — nada bajo el umbral.'}
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-sand bg-snow">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-body text-sm">
            <thead>
              <tr className="bg-cream">
                <th className="px-4 py-3 text-left text-xs font-medium text-taupe">Producto</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-taupe">Físico</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-taupe">Reservado</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-taupe">Disponible</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-taupe">Umbral</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t border-sand transition ${
                    p.isLowStock ? 'bg-tan/20' : 'hover:bg-cream/60'
                  }`}
                >
                  <td className="px-4 py-3.5 align-middle">
                    <div className="text-[15px] font-medium leading-snug text-soot">{p.name}</div>
                    <div className="mt-0.5 text-[13px] font-normal text-taupe">
                      {p.category.name} · {p.sku}
                    </div>
                  </td>
                  <td className="price-mono px-4 py-3.5 text-right align-middle text-[15px] text-soot">
                    {p.stock}
                  </td>
                  <td className="price-mono px-4 py-3.5 text-right align-middle text-[15px] text-taupe">
                    {p.reserved}
                  </td>
                  <td className="price-mono px-4 py-3.5 text-right align-middle text-[15px]">
                    <span
                      className={
                        p.available === 0
                          ? 'font-semibold text-alert'
                          : p.isLowStock
                            ? 'font-semibold text-rust-dark'
                            : 'text-soot'
                      }
                    >
                      {p.available}
                    </span>
                  </td>
                  <td className="price-mono px-4 py-3.5 text-right align-middle text-[15px] text-taupe">
                    {p.lowStockThreshold}
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <div className="flex items-center justify-end gap-4">
                      <StockAdjustPanel
                        productId={p.id}
                        productName={p.name}
                        currentStock={p.stock}
                      />
                      <Link
                        href={`/trastienda/inventario/${p.id}/historico`}
                        className="text-[13px] font-medium text-taupe transition hover:text-soot hover:underline"
                      >
                        Historial
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {products.length === 0 && (
          <p className="px-4 py-6 text-sm text-taupe">No hay productos activos.</p>
        )}
      </div>
    </div>
  );
}
