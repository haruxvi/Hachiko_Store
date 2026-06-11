import Link from 'next/link';
import type { Metadata } from 'next';
import { getProducts, getCategories, type ProductSort } from '@/src/lib/services/catalog.service';

export const metadata: Metadata = {
  title: 'Catálogo — Hachiko',
  description:
    'Catálogo de productos coreanos: snacks, skincare, papelería y merch K-pop con despacho a todo Chile.',
};

interface Props {
  searchParams: Promise<{
    categoria?: string;
    q?: string;
    pagina?: string;
    orden?: string;
    stock?: string;
  }>;
}

const VALID_SORTS: ProductSort[] = ['recent', 'price-asc', 'price-desc'];

export default async function CatalogoPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params.pagina ?? 1);
  const sort = VALID_SORTS.includes(params.orden as ProductSort)
    ? (params.orden as ProductSort)
    : 'recent';
  const inStockOnly = params.stock === '1';

  const [{ products, total, totalPages }, categories] = await Promise.all([
    getProducts({
      categorySlug: params.categoria,
      search: params.q,
      sort,
      inStockOnly,
      page,
      limit: 24,
    }),
    getCategories(),
  ]);

  // Conserva los filtros activos al navegar (paginación, orden)
  const baseQuery = (overrides: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = {
      categoria: params.categoria,
      q: params.q,
      orden: params.orden,
      stock: params.stock,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) q.set(k, v);
    }
    const s = q.toString();
    return s ? `?${s}` : '';
  };

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
          {/* Búsqueda y filtros — formulario GET: funciona sin JavaScript */}
          <form method="get" action="/catalogo" className="flex flex-wrap items-center gap-3 mb-6">
            {params.categoria && <input type="hidden" name="categoria" value={params.categoria} />}
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Buscar productos…"
              aria-label="Buscar productos"
              className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
            <select
              name="orden"
              defaultValue={sort}
              aria-label="Ordenar por"
              className="border rounded-lg px-2 py-2 text-sm bg-white"
            >
              <option value="recent">Más recientes</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="checkbox" name="stock" value="1" defaultChecked={inStockOnly} />
              Solo con stock
            </label>
            <button
              type="submit"
              className="bg-rose-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-rose-600"
            >
              Filtrar
            </button>
          </form>

          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-gray-500">
              {total} productos{params.q ? ` para “${params.q}”` : ''}
            </p>
          </div>

          {products.length === 0 ? (
            <p className="text-gray-500 py-20 text-center">
              {params.q ? 'No encontramos productos para tu búsqueda.' : 'No hay productos en esta categoría.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((p) => (
                <Link key={p.id} href={`/producto/${p.slug}`} className="group block">
                  <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-3">
                    {p.images[0] ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- URLs externas sin host fijo; next/image exige remotePatterns */
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        loading="lazy"
                        decoding="async"
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
                  {p.stock === 0 ? (
                    <span className="text-xs text-gray-400">Sin stock</span>
                  ) : p.stock <= p.lowStockThreshold ? (
                    <span className="text-xs text-amber-600 font-medium">¡Quedan pocas unidades!</span>
                  ) : null}
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
                  href={`/catalogo${baseQuery({ pagina: String(n) })}`}
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
