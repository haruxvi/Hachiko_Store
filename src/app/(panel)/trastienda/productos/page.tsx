import Link from 'next/link';
import { getSession } from '@/src/lib/auth/session';
import { db } from '@/src/lib/db';
import { archiveProductAction, restoreProductAction } from '@/src/actions/inventory';

export const revalidate = 0;

export default async function ProductosPage() {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const products = await db.product.findMany({
    include: { category: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const active = products.filter((p) => !p.archivedAt);
  const archived = products.filter((p) => p.archivedAt);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Productos</h1>
        <Link
          href="/trastienda/productos/nuevo"
          className="bg-rose-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-rose-700"
        >
          + Nuevo producto
        </Link>
      </div>

      <ProductTable products={active} showRestore={false} />

      {archived.length > 0 && (
        <details className="mt-8">
          <summary className="text-sm text-gray-400 cursor-pointer mb-3">
            Archivados ({archived.length})
          </summary>
          <ProductTable products={archived} showRestore={true} />
        </details>
      )}
    </div>
  );
}

type Product = {
  id: string;
  sku: string;
  name: string;
  priceCLP: number;
  stock: number;
  lowStockThreshold: number;
  active: boolean;
  archivedAt: Date | null;
  category: { name: string };
};

function ProductTable({
  products,
  showRestore,
}: {
  products: Product[];
  showRestore: boolean;
}) {
  if (products.length === 0) {
    return <p className="text-sm text-gray-400">Sin productos.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left">
          <th className="py-2 pr-4 font-medium text-gray-500">SKU</th>
          <th className="py-2 pr-4 font-medium text-gray-500">Nombre</th>
          <th className="py-2 pr-4 font-medium text-gray-500">Categoría</th>
          <th className="py-2 pr-4 font-medium text-gray-500 text-right">Precio</th>
          <th className="py-2 pr-4 font-medium text-gray-500 text-right">Stock</th>
          <th className="py-2 font-medium text-gray-500"></th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
            <td className="py-2 pr-4 font-mono text-xs text-gray-500">{p.sku}</td>
            <td className="py-2 pr-4">{p.name}</td>
            <td className="py-2 pr-4 text-gray-500">{p.category.name}</td>
            <td className="py-2 pr-4 text-right">
              {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(
                p.priceCLP,
              )}
            </td>
            <td className="py-2 pr-4 text-right">
              <span
                className={
                  p.stock === 0
                    ? 'text-red-600 font-medium'
                    : p.stock <= p.lowStockThreshold
                      ? 'text-amber-600 font-medium'
                      : ''
                }
              >
                {p.stock}
              </span>
            </td>
            <td className="py-2">
              <div className="flex gap-2 justify-end">
                <Link
                  href={`/trastienda/productos/${p.id}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Editar
                </Link>
                <Link
                  href={`/trastienda/inventario/${p.id}/historico`}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Historial
                </Link>
                {showRestore ? (
                  <form
                    action={async () => {
                      'use server';
                      await restoreProductAction(p.id);
                    }}
                  >
                    <button type="submit" className="text-xs text-green-600 hover:underline">
                      Restaurar
                    </button>
                  </form>
                ) : (
                  <form
                    action={async () => {
                      'use server';
                      await archiveProductAction(p.id);
                    }}
                  >
                    <button type="submit" className="text-xs text-red-500 hover:underline">
                      Archivar
                    </button>
                  </form>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
