import Link from 'next/link';
import { getSession } from '@/src/lib/auth/session';
import { getInventoryMaster } from '@/src/lib/services/dashboard.service';
import { getCategories } from '@/src/lib/services/catalog.service';
import StockAdjustPanel from '@/src/components/panel/StockAdjustPanel';
import ListToolbar from '@/src/components/panel/ListToolbar';
import PanelPagination from '@/src/components/panel/PanelPagination';
import {
  parseOption,
  parsePage,
  parsePageSize,
  parseQuery,
  one,
  DEFAULT_PAGE_SIZE,
  type RawSearchParams,
} from '@/src/lib/panel-list';

export const revalidate = 0;

const BASE = '/trastienda/inventario';
const STOCK_FILTERS = ['todo', 'bajo'] as const;

export default async function InventarioPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const sp = await searchParams;
  const q = parseQuery(sp['q']);
  const stockFilter = parseOption(sp['stock'], STOCK_FILTERS, 'todo');
  const perPage = parsePageSize(sp['mostrar']);
  const page = parsePage(sp['pagina']);

  const categories = await getCategories(false);
  const category = categories.find((c) => c.slug === one(sp['categoria']));

  const { info, lowCount, products } = await getInventoryMaster({
    q,
    categoryId: category?.id,
    lowOnly: stockFilter === 'bajo',
    page,
    perPage,
  });

  const params = {
    q: q || undefined,
    categoria: category?.slug,
    stock: stockFilter !== 'todo' ? stockFilter : undefined,
    mostrar: perPage !== DEFAULT_PAGE_SIZE ? String(perPage) : undefined,
  };
  const filtered = Boolean(q || category || stockFilter !== 'todo');

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
          {lowCount > 0 && stockFilter !== 'bajo' && (
            <>
              {' '}
              <Link
                href={`${BASE}?stock=bajo`}
                className="font-body text-[13px] font-semibold not-italic text-soot underline decoration-rust decoration-2 underline-offset-4 hover:decoration-soot"
              >
                Ver solo esos
              </Link>
            </>
          )}
        </div>
      </header>

      <ListToolbar
        basePath={BASE}
        query={q}
        perPage={perPage}
        searchLabel="Buscar producto"
        placeholder="Nombre o SKU"
        clearable={filtered}
        filters={[
          {
            name: 'categoria',
            label: 'Categoría',
            value: category?.slug ?? '',
            options: [{ value: '', label: 'Todas' }, ...categories.map((c) => ({ value: c.slug, label: c.name }))],
          },
          {
            name: 'stock',
            label: 'Stock',
            value: stockFilter,
            options: [
              { value: 'todo', label: 'Todo el inventario' },
              { value: 'bajo', label: 'Solo bajo el umbral' },
            ],
          },
        ]}
      />

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
                            ? 'font-semibold text-rust-ink'
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
          <p className="px-4 py-10 text-center text-[15px] text-taupe-deep">
            {filtered ? 'Nada coincide con la búsqueda o los filtros.' : 'No hay productos activos.'}
          </p>
        )}
      </div>

      <PanelPagination basePath={BASE} params={params} info={info} noun={['producto', 'productos']} />
    </div>
  );
}
