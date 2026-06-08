import Link from 'next/link';
import { getProducts, getCategories } from '@/src/lib/services/catalog.service';

interface Props {
  searchParams: Promise<{ categoria?: string; q?: string; pagina?: string }>;
}

export default async function CatalogoPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params.pagina ?? 1);

  const [{ products, total, totalPages }, categories] = await Promise.all([
    getProducts({
      categorySlug: params.categoria,
      search: params.q,
      page,
      limit: 24,
    }),
    getCategories(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex flex-col sm:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full sm:w-48 shrink-0">
          <h2 className="font-bold mb-3 text-sm uppercase tracking-wide text-gray-500">Categorías</h2>
          <nav className="flex flex-col gap-1">
            <Link
              href="/catalogo"
              className={`text-sm px-3 py-2 rounded-lg hover:bg-rose-50 ${!params.categoria ? 'bg-rose-100 font-semibold' : ''}`}
            >
              Todo
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/catalogo?categoria=${c.slug}`}
                className={`text-sm px-3 py-2 rounded-lg hover:bg-rose-50 ${params.categoria === c.slug ? 'bg-rose-100 font-semibold' : ''}`}
              >
                {c.name}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-gray-500">{total} productos</p>
          </div>

          {products.length === 0 ? (
            <p className="text-gray-500 py-20 text-center">No hay productos en esta categoría.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((p) => (
                <Link key={p.id} href={`/producto/${p.slug}`} className="group block">
                  <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-3">
                    {p.images[0] ? (
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">
                        🛍️
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-sm line-clamp-2">{p.name}</h3>
                  <p className="text-rose-600 font-bold mt-1">
                    ${p.priceCLP.toLocaleString('es-CL')}
                  </p>
                  {p.stock === 0 && (
                    <span className="text-xs text-gray-400">Sin stock</span>
                  )}
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex gap-2 mt-10 justify-center">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={`/catalogo?${params.categoria ? `categoria=${params.categoria}&` : ''}pagina=${n}`}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${n === page ? 'bg-rose-500 text-white' : 'border hover:bg-rose-50'}`}
                >
                  {n}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
