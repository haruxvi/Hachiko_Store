import { notFound } from 'next/navigation';
import { getSession } from '@/src/lib/auth/session';
import { getProductById, getCategories, getPriceHistory } from '@/src/lib/services/catalog.service';
import ProductForm from '@/src/components/panel/ProductForm';

const clp = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const { id } = await params;
  const [product, categories, priceHistory] = await Promise.all([
    getProductById(id),
    getCategories(false),
    getPriceHistory(id),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-6 text-xl font-bold">Editar: {product.name}</h1>
        <ProductForm categories={categories} initial={product} />
      </div>

      <section className="card-hs shadow-soft p-6">
        <h2 className="editorial text-[15px] text-taupe">Historial de precios</h2>
        {priceHistory.length === 0 ? (
          <p className="mt-3 text-sm text-taupe">Sin cambios de precio registrados todavía.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {priceHistory.map((h) => {
              const up = h.newCLP > h.previousCLP;
              return (
                <li key={h.id} className="flex items-center justify-between border-b border-sand/60 pb-2 last:border-0">
                  <span className="text-taupe">{new Date(h.createdAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <span className="text-soot">
                    <span className="price-mono text-taupe">{clp(h.previousCLP)}</span>
                    <span className="mx-2 text-taupe">→</span>
                    <span className={`price-mono ${up ? 'text-alert' : 'text-mint-deep'}`}>{clp(h.newCLP)} {up ? '▲' : '▼'}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
