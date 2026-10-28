import { getSession } from '@/src/lib/auth/session';
import { listCategoriesForPanel } from '@/src/lib/services/catalog.service';
import CategoryManager from '@/src/components/panel/CategoryManager';
import ListToolbar from '@/src/components/panel/ListToolbar';
import PanelPagination from '@/src/components/panel/PanelPagination';
import {
  parseOption,
  parsePage,
  parsePageSize,
  parseQuery,
  DEFAULT_PAGE_SIZE,
  type RawSearchParams,
} from '@/src/lib/panel-list';

export const revalidate = 0;

const BASE = '/trastienda/categorias';
const STATUSES = ['activas', 'archivadas'] as const;

export default async function CategoriasPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const sp = await searchParams;
  const q = parseQuery(sp['q']);
  const status = parseOption(sp['estado'], STATUSES, 'activas');
  const perPage = parsePageSize(sp['mostrar']);
  const page = parsePage(sp['pagina']);

  const { info, items } = await listCategoriesForPanel({
    q,
    archived: status === 'archivadas',
    page,
    perPage,
  });

  const params = {
    q: q || undefined,
    estado: status !== 'activas' ? status : undefined,
    mostrar: perPage !== DEFAULT_PAGE_SIZE ? String(perPage) : undefined,
  };
  const filtered = Boolean(q || status !== 'activas');

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.015em] text-soot">
          Categorías
        </h1>
        <p className="editorial mt-1.5 text-[15px] leading-snug text-taupe">
          Cómo se agrupa el catálogo en la tienda. El orden define cuál aparece primero.
        </p>
      </header>

      <ListToolbar
        basePath={BASE}
        query={q}
        perPage={perPage}
        searchLabel="Buscar categoría"
        placeholder="Nombre o descripción"
        clearable={filtered}
        filters={[
          {
            name: 'estado',
            label: 'Estado',
            value: status,
            options: [
              { value: 'activas', label: 'Activas' },
              { value: 'archivadas', label: 'Archivadas' },
            ],
          },
        ]}
      />

      <CategoryManager
        categories={items.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          order: c.order,
          archived: c.archivedAt !== null,
          productCount: c._count.products,
        }))}
        emptyMessage={filtered ? 'Ninguna categoría coincide con la búsqueda.' : 'Todavía no hay categorías.'}
        canCreate={status === 'activas'}
      />

      <PanelPagination basePath={BASE} params={params} info={info} noun={['categoría', 'categorías']} />
    </div>
  );
}
