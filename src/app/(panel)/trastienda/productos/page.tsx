import Link from 'next/link';
import { getSession } from '@/src/lib/auth/session';
import {
  getCategories,
  listProductsForPanel,
  type PanelProductSort,
  type PanelProductStatus,
} from '@/src/lib/services/catalog.service';
import { archiveProductAction, restoreProductAction } from '@/src/actions/inventory';
import { formatCLP } from '@/src/lib/format';
import {
  parseOption,
  parsePage,
  parsePageSize,
  parseQuery,
  one,
  DEFAULT_PAGE_SIZE,
  type RawSearchParams,
} from '@/src/lib/panel-list';
import ListToolbar from '@/src/components/panel/ListToolbar';
import PanelPagination from '@/src/components/panel/PanelPagination';

export const revalidate = 0;

const BASE = '/trastienda/productos';
const STATUSES = ['activos', 'archivados'] as const satisfies readonly PanelProductStatus[];
const SORTS = ['recientes', 'nombre', 'precio-asc', 'precio-desc', 'stock-asc'] as const satisfies readonly PanelProductSort[];
const SORT_LABELS: Record<PanelProductSort, string> = {
  recientes: 'Más recientes',
  nombre: 'Nombre (A–Z)',
  'precio-asc': 'Precio: menor a mayor',
  'precio-desc': 'Precio: mayor a menor',
  'stock-asc': 'Menos stock primero',
};

export default async function ProductosPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const sp = await searchParams;
  const q = parseQuery(sp['q']);
  const status = parseOption(sp['estado'], STATUSES, 'activos');
  const sort = parseOption(sp['orden'], SORTS, 'recientes');
  const perPage = parsePageSize(sp['mostrar']);
  const page = parsePage(sp['pagina']);

  const categories = await getCategories(false);
  // La categoría viaja por slug (URL legible); solo se acepta una que exista.
  const category = categories.find((c) => c.slug === one(sp['categoria']));

  const { info, items: products } = await listProductsForPanel({
    q,
    categoryId: category?.id,
    status,
    sort,
    page,
    perPage,
  });

  const params = {
    q: q || undefined,
    categoria: category?.slug,
    estado: status !== 'activos' ? status : undefined,
    orden: sort !== 'recientes' ? sort : undefined,
    mostrar: perPage !== DEFAULT_PAGE_SIZE ? String(perPage) : undefined,
  };
  const filtered = Boolean(q || category || status !== 'activos');

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.015em] text-soot">
            Productos
          </h1>
          <p className="editorial mt-1.5 text-[15px] leading-snug text-taupe">
            {status === 'archivados' ? 'Los que sacaste de la tienda. Puedes restaurarlos.' : 'Todo lo que está a la venta.'}
          </p>
        </div>
        <Link href={`${BASE}/nuevo`} className="btn-primary btn-sm min-h-11">
          + Nuevo producto
        </Link>
      </header>

      <ListToolbar
        basePath={BASE}
        query={q}
        perPage={perPage}
        searchLabel="Buscar producto"
        placeholder="Nombre o SKU"
        clearable={filtered || sort !== 'recientes'}
        filters={[
          {
            name: 'categoria',
            label: 'Categoría',
            value: category?.slug ?? '',
            options: [{ value: '', label: 'Todas' }, ...categories.map((c) => ({ value: c.slug, label: c.name }))],
          },
          {
            name: 'estado',
            label: 'Estado',
            value: status,
            options: [
              { value: 'activos', label: 'A la venta' },
              { value: 'archivados', label: 'Archivados' },
            ],
          },
          {
            name: 'orden',
            label: 'Ordenar',
            value: sort,
            options: SORTS.map((s) => ({ value: s, label: SORT_LABELS[s] })),
          },
        ]}
      />

      <div className="overflow-hidden rounded-2xl border border-sand bg-snow">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-body text-sm">
            <thead>
              <tr className="bg-cream">
                <th className="px-4 py-3 text-left text-xs font-medium text-taupe">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-taupe">Categoría</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-taupe">Precio</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-taupe">Stock</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const archived = p.archivedAt !== null;
                return (
                  <tr key={p.id} className="border-t border-sand transition hover:bg-cream/60">
                    <td className="px-4 py-3.5 align-middle">
                      <div className="text-[15px] font-medium leading-snug text-soot">{p.name}</div>
                      <div className="price-mono mt-0.5 text-[12px] text-taupe-deep">{p.sku}</div>
                    </td>
                    <td className="px-4 py-3.5 align-middle text-[14px] text-taupe-deep">{p.category.name}</td>
                    <td className="price-mono whitespace-nowrap px-4 py-3.5 text-right align-middle text-[15px] text-soot">
                      {formatCLP(p.priceCLP)}
                    </td>
                    <td className="price-mono px-4 py-3.5 text-right align-middle text-[15px]">
                      <span
                        className={
                          p.stock === 0
                            ? 'font-semibold text-alert'
                            : p.stock <= p.lowStockThreshold
                              ? 'font-semibold text-rust-ink'
                              : 'text-soot'
                        }
                      >
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-center justify-end gap-4 whitespace-nowrap text-[13px] font-medium">
                        <Link href={`${BASE}/${p.id}`} className="text-soot underline decoration-rust decoration-2 underline-offset-4 hover:decoration-soot">
                          Editar
                        </Link>
                        <Link
                          href={`/trastienda/inventario/${p.id}/historico`}
                          className="text-taupe-deep transition hover:text-soot hover:underline"
                        >
                          Historial
                        </Link>
                        <form
                          action={async () => {
                            'use server';
                            if (archived) await restoreProductAction(p.id);
                            else await archiveProductAction(p.id);
                          }}
                        >
                          <button
                            type="submit"
                            className={`transition hover:underline ${archived ? 'text-mint-ink' : 'text-alert'}`}
                          >
                            {archived ? 'Restaurar' : 'Archivar'}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {products.length === 0 && (
          <p className="px-4 py-10 text-center text-[15px] text-taupe-deep">
            {filtered
              ? 'Nada coincide con la búsqueda o los filtros.'
              : 'Todavía no hay productos. Crea el primero con “Nuevo producto”.'}
          </p>
        )}
      </div>

      <PanelPagination basePath={BASE} params={params} info={info} noun={['producto', 'productos']} />
    </div>
  );
}
