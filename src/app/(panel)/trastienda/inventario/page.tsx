import Link from 'next/link';
import { getSession } from '@/src/lib/auth/session';
import { getInventoryMaster } from '@/src/lib/services/dashboard.service';
import StockAdjustPanel from '@/src/components/panel/StockAdjustPanel';

export const revalidate = 0;

export default async function InventarioPage() {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const products = await getInventoryMaster();

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Inventario</h1>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4 font-medium text-gray-500">Producto</th>
            <th className="py-2 pr-4 font-medium text-gray-500 text-right">Físico</th>
            <th className="py-2 pr-4 font-medium text-gray-500 text-right">Reservado</th>
            <th className="py-2 pr-4 font-medium text-gray-500 text-right">Disponible</th>
            <th className="py-2 pr-4 font-medium text-gray-500 text-right">Umbral</th>
            <th className="py-2 font-medium text-gray-500"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className={`border-b last:border-0 ${p.isLowStock ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
              <td className="py-2 pr-4">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.category.name} · {p.sku}</p>
                </div>
              </td>
              <td className="py-2 pr-4 text-right font-mono">{p.stock}</td>
              <td className="py-2 pr-4 text-right font-mono text-gray-400">{p.reserved}</td>
              <td className="py-2 pr-4 text-right font-mono">
                <span
                  className={
                    p.available === 0
                      ? 'text-red-600 font-semibold'
                      : p.isLowStock
                        ? 'text-amber-600 font-semibold'
                        : ''
                  }
                >
                  {p.available}
                </span>
              </td>
              <td className="py-2 pr-4 text-right text-gray-400 font-mono">{p.lowStockThreshold}</td>
              <td className="py-2">
                <div className="flex gap-3 justify-end">
                  <StockAdjustPanel
                    productId={p.id}
                    productName={p.name}
                    currentStock={p.stock}
                  />
                  <Link
                    href={`/trastienda/inventario/${p.id}/historico`}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Historial
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {products.length === 0 && (
        <p className="text-sm text-gray-400 mt-4">No hay productos activos.</p>
      )}
    </div>
  );
}
