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

// Checkbox custom del sistema de diseño: caja 18px radio 6, rust al activarse.
function FilterCheck({ label, checked, href }: { label: string; checked: boolean; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 py-1.5 text-sm">
      <span
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] text-snow ${
          checked ? 'border-rust bg-rust' : 'border-sand bg-snow'
        }`}
      >
        {checked && <Icon name="check" size={12} stroke={2.5} />}
      </span>
      <span className={`flex-1 text-soot ${checked ? 'font-semibold' : 'font-medium'}`}>
        {label}
      </span>
    </Link>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 border-b border-sand pb-6">
      <div className="mb-3 flex items-center justify-between font-display text-[15px] font-bold text-soot">
        {title}
        <Icon name="chevron" size={14} stroke={2} />
      </div>
      {children}
    </div>
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

  // Conserva los filtros activos al navegar (paginación, orden, stock)
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
    <div className="mx-auto max-w-[1440px] px-6 sm:px-12">
      {/* Breadcrumb + título */}
      <section className="pb-6 pt-10">
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
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="hangul mb-1 text-[15px] text-taupe">하치코 · 카탈로그</div>
            <h1 className="font-display text-4xl font-bold leading-none tracking-[-0.02em] text-soot sm:text-5xl">
              {activeCategory?.name ?? 'Catálogo'}
            </h1>
            <p className="mt-3 max-w-[520px] text-[15px] text-taupe">
              {params.q
                ? `Resultados para “${params.q}”.`
                : 'Curado a mano y empacado en Recoleta. Lo que ves es lo que hay en bodega.'}
            </p>
          </div>

          {/* Orden — formulario GET: funciona sin JavaScript */}
          <form method="get" action="/catalogo" className="flex items-center gap-2">
            {params.categoria && <input type="hidden" name="categoria" value={params.categoria} />}
            {params.q && <input type="hidden" name="q" value={params.q} />}
            {params.stock && <input type="hidden" name="stock" value={params.stock} />}
            <span className="text-[13px] text-taupe">Ordenar</span>
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
            <button type="submit" className="btn-outline btn-sm">
              Aplicar
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-8 pt-2 lg:grid-cols-[260px_1fr] lg:gap-12">
        {/* Filtros laterales — persistentes, no drawer */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <FilterGroup title="Buscar">
            <form method="get" action="/catalogo" className="flex gap-2">
              {params.categoria && (
                <input type="hidden" name="categoria" value={params.categoria} />
              )}
              <input
                type="search"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="Buscar productos…"
                aria-label="Buscar productos"
                className="input-hs"
              />
            </form>
          </FilterGroup>

          <FilterGroup title="Categoría">
            <FilterCheck label="Todo" checked={!params.categoria} href="/catalogo" />
            {categories.map((c) => (
              <FilterCheck
                key={c.id}
                label={c.name}
                checked={params.categoria === c.slug}
                href={`/catalogo${baseQuery({ categoria: c.slug, pagina: undefined })}`}
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Stock">
            <FilterCheck
              label="Disponible ahora"
              checked={inStockOnly}
              href={`/catalogo${baseQuery({ stock: inStockOnly ? undefined : '1', pagina: undefined })}`}
            />
          </FilterGroup>

          {activeChips.length > 0 && (
            <Link href="/catalogo" className="btn-link mt-2 !text-[13px]">
              Limpiar {activeChips.length} {activeChips.length === 1 ? 'filtro activo' : 'filtros activos'}
            </Link>
          )}
        </aside>

        {/* Grid */}
        <div>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <Link key={chip.label} href={chip.href} className="chip-rust gap-2">
                {chip.label} <Icon name="close" size={11} />
              </Link>
            ))}
            <span className="ml-auto self-center text-[13px] text-taupe">
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
            <div className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-3">
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
