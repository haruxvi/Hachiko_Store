import Link from 'next/link';
import type { Metadata } from 'next';
import { getProducts, getCategories, type ProductSort } from '@/src/lib/services/catalog.service';
import ProductCardHs from '@/src/components/storefront/ProductCardHs';
import Icon from '@/src/components/ui/Icon';

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

const SORT_LABELS: Record<ProductSort, string> = {
  recent: 'Más recientes',
  'price-asc': 'Precio: menor a mayor',
  'price-desc': 'Precio: mayor a menor',
};

// Checkbox custom adaptado para distribución horizontal (chips/píldoras)
function FilterCheck({ label, checked, href }: { label: string; checked: boolean; href: string }) {
  return (
    <Link 
      href={href} 
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        checked 
          ? 'border-rust bg-rust/10 text-rust font-semibold' 
          : 'border-sand bg-snow text-soot hover:border-taupe'
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          checked ? 'border-rust bg-rust text-snow' : 'border-sand bg-snow'
        }`}
      >
        {checked && <Icon name="check" size={10} stroke={2.5} />}
      </span>
      <span>{label}</span>
    </Link>
  );
}

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

  const activeCategory = categories.find((c) => c.slug === params.categoria);

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

  const activeChips: { label: string; href: string }[] = [];
  if (activeCategory)
    activeChips.push({ label: activeCategory.name, href: `/catalogo${baseQuery({ categoria: undefined, pagina: undefined })}` });
  if (params.q)
    activeChips.push({ label: `“${params.q}”`, href: `/catalogo${baseQuery({ q: undefined, pagina: undefined })}` });
  if (inStockOnly)
    activeChips.push({ label: 'Disponible ahora', href: `/catalogo${baseQuery({ stock: undefined, pagina: undefined })}` });

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-12">
      {/* Breadcrumb + título */}
      <section className="pb-4 pt-6 sm:pt-10">
        <div className="mb-4 flex items-center gap-1.5 text-[13px] text-taupe">
          <Link href="/" className="hover:text-rust">
            Inicio
          </Link>
          <Icon name="chevronR" size={12} />
          {activeCategory ? (
            <>
              <Link href="/catalogo" className="hover:text-rust">
                Catálogo
              </Link>
              <Icon name="chevronR" size={12} />
              <span className="text-soot">{activeCategory.name}</span>
            </>
          ) : (
            <span className="text-soot">Catálogo</span>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="hangul mb-1 text-[15px] text-taupe">하치코 · 카탈로그</div>
            <h1 className="font-display text-3xl sm:text-5xl font-bold leading-none tracking-[-0.02em] text-soot">
              {activeCategory?.name ?? 'Catálogo'}
            </h1>
            <p className="mt-2 max-w-[520px] text-[14px] sm:text-[15px] text-taupe">
              {params.q
                ? `Resultados para “${params.q}”.`
                : 'Curado a mano y empacado en Recoleta. Lo que ves es lo que hay en bodega.'}
            </p>
          </div>

          {/* Formulario Ordenar */}
          <form method="get" action="/catalogo" className="flex items-center gap-2">
            {params.categoria && <input type="hidden" name="categoria" value={params.categoria} />}
            {params.q && <input type="hidden" name="q" value={params.q} />}
            {params.stock && <input type="hidden" name="stock" value={params.stock} />}
            <span className="text-[13px] text-taupe shrink-0">Ordenar</span>
            <select
              name="orden"
              defaultValue={sort}
              aria-label="Ordenar por"
              className="rounded-chip border border-sand bg-snow px-3 py-2 text-[13px] font-medium text-soot focus:border-rust focus:outline-none"
            >
              {VALID_SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-outline btn-sm shrink-0">
              Aplicar
            </button>
          </form>
        </div>
      </section>

      {/* FILTROS EN LÍNEA HORIZONTAL */}
      <section className="flex flex-col gap-6 pt-4">
        <aside className="w-full border-y border-sand py-4 flex flex-col gap-4">
          
          {/* Fila de Buscador + Stock */}
          <div className="flex flex-wrap items-center gap-4 justify-between">
            {/* Buscador */}
            <form method="get" action="/catalogo" className="flex-1 min-w-[240px] max-w-xs">
              {params.categoria && (
                <input type="hidden" name="categoria" value={params.categoria} />
              )}
              <input
                type="search"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="Buscar productos…"
                aria-label="Buscar productos"
                className="input-hs w-full text-xs"
              />
            </form>

            {/* Filtro de Stock */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-soot uppercase tracking-wider">Stock:</span>
              <FilterCheck
                label="Disponible ahora"
                checked={inStockOnly}
                href={`/catalogo${baseQuery({ stock: inStockOnly ? undefined : '1', pagina: undefined })}`}
              />
            </div>
          </div>

          {/* Fila de Categorías al lado (Scroll Horizontal en móvil) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
            <span className="text-xs font-bold text-soot uppercase tracking-wider shrink-0 mr-1">
              Categoría:
            </span>
            <FilterCheck label="Todo" checked={!params.categoria} href="/catalogo" />
            {categories.map((c) => (
              <FilterCheck
                key={c.id}
                label={c.name}
                checked={params.categoria === c.slug}
                href={`/catalogo${baseQuery({ categoria: c.slug, pagina: undefined })}`}
              />
            ))}
          </div>

          {/* Limpiar filtros si existen activos */}
          {activeChips.length > 0 && (
            <div>
              <Link href="/catalogo" className="btn-link !text-[12px]">
                Limpiar {activeChips.length} {activeChips.length === 1 ? 'filtro activo' : 'filtros activos'}
              </Link>
            </div>
          )}
        </aside>

        {/* Grid de Productos */}
        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {activeChips.map((chip) => (
                <Link key={chip.label} href={chip.href} className="chip-rust gap-2">
                  {chip.label} <Icon name="close" size={11} />
                </Link>
              ))}
            </div>
            <span className="text-[13px] text-taupe ml-auto">
              {total} {total === 1 ? 'producto' : 'productos'}
            </span>
          </div>

          {products.length === 0 ? (
            <p className="py-20 text-center text-taupe">
              {params.q
                ? 'No encontramos productos para tu búsqueda.'
                : 'No hay productos en esta categoría.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCardHs
                  key={p.id}
                  product={{
                    slug: p.slug,
                    name: p.name,
                    nameKorean: p.nameKorean,
                    priceCLP: p.priceCLP,
                    image: p.images[0] ?? null,
                    stock: p.stock,
                    lowStockThreshold: p.lowStockThreshold,
                  }}
                />
              ))}
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-2 border-t border-sand pt-8">
              {page > 1 && (
                <Link
                  href={`/catalogo${baseQuery({ pagina: String(page - 1) })}`}
                  aria-label="Página anterior"
                  className="btn-outline btn-sm !p-2"
                >
                  <Icon name="chevronL" size={14} />
                </Link>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={`/catalogo${baseQuery({ pagina: String(n) })}`}
                  className={`btn-sm min-w-9 justify-center rounded-chip text-center font-medium ${
                    n === page ? 'bg-soot text-snow' : 'text-taupe hover:bg-soot/5'
                  } inline-flex items-center px-3 py-2 text-[13px]`}
                >
                  {n}
                </Link>
              ))}
              {page < totalPages && (
                <Link
                  href={`/catalogo${baseQuery({ pagina: String(page + 1) })}`}
                  aria-label="Página siguiente"
                  className="btn-outline btn-sm !p-2"
                >
                  <Icon name="chevronR" size={14} />
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}