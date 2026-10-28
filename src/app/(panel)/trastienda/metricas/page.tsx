import {
  getMetricsDashboard,
  getAlerts,
  getSalesAnomalies,
  type MetricPoint,
  type CategoryRow,
  type ProductRow,
  type CommuneRow,
} from '@/src/lib/services/intelligence.service';
import Link from 'next/link';
import IntelligencePlaceholder from '@/src/components/panel/IntelligencePlaceholder';
import ListToolbar from '@/src/components/panel/ListToolbar';
import PanelPagination from '@/src/components/panel/PanelPagination';
import { Stat } from '@/src/components/panel/intelligence-ui';
import Icon from '@/src/components/ui/Icon';
import {
  DEFAULT_PAGE_SIZE,
  hrefWith,
  matchesQuery,
  one,
  paginate,
  parseOption,
  parsePage,
  parsePageSize,
  parseQuery,
  type RawSearchParams,
} from '@/src/lib/panel-list';

const BASE = '/trastienda/metricas';
const CLASES = ['todas', 'A', 'B', 'C'] as const;
const MARGENES = ['todos', 'con-costo', 'sin-costo'] as const;
const ORDENES = ['ingresos', 'unidades', 'margen', 'margen-pct', 'nombre'] as const;
const TOP_COMUNAS = 10;

const clp = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Math.round(n));
const clpShort = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;
const pct = (n: number | null) => (n === null ? 'sin costo' : `${(n * 100).toFixed(1)}%`);
const num = (n: number) => n.toLocaleString('es-CL');
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// Períodos guardados a medianoche UTC: leer en UTC para no correr el mes en Chile.
const monthLabel = (d: Date) => `${MONTHS_ES[new Date(d).getUTCMonth()]} ${new Date(d).getUTCFullYear()}`;

export default async function MetricasPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const [d, alerts, anomalies] = await Promise.all([getMetricsDashboard(), getAlerts(), getSalesAnomalies()]);

  // ── Filtros de la clasificación ABC (formulario GET: funcionan sin JavaScript) ──
  const q = parseQuery(sp['q']);
  const clase = parseOption(sp['clase'], CLASES, 'todas');
  const margen = parseOption(sp['margen'], MARGENES, 'todos');
  const orden = parseOption(sp['orden'], ORDENES, 'ingresos');
  const perPage = parsePageSize(sp['mostrar']);
  const page = parsePage(sp['pagina']);
  const allComunas = one(sp['comunas']) === 'todas';

  const categoryOptions = [...new Map(d.products.filter((p) => p.category).map((p) => [p.category!.slug, p.category!.name])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'es'));
  const categoria = parseOption(one(sp['categoria']), categoryOptions.map(([slug]) => slug), '' as string);

  const filtered = d.products
    .filter((p) => clase === 'todas' || p.abc === clase)
    .filter((p) => !categoria || p.category?.slug === categoria)
    .filter((p) => margen === 'todos' || (margen === 'con-costo' ? p.marginPct !== null : p.marginPct === null))
    .filter((p) => matchesQuery(q, p.name, p.category?.name))
    .sort((a, b) => {
      if (orden === 'unidades') return b.units - a.units;
      if (orden === 'margen') return b.margin - a.margin;
      if (orden === 'margen-pct') return (b.marginPct ?? -1) - (a.marginPct ?? -1);
      if (orden === 'nombre') return a.name.localeCompare(b.name, 'es');
      return b.revenue - a.revenue;
    });
  const info = paginate(filtered.length, page, perPage);
  const pageRows = filtered.slice(info.skip, info.skip + info.take);
  const filteredRevenue = filtered.reduce((a, p) => a + p.revenue, 0);
  const totalRevenue = d.products.reduce((a, p) => a + p.revenue, 0);
  const isFiltered = Boolean(q || clase !== 'todas' || categoria || margen !== 'todos' || orden !== 'ingresos');
  const params = {
    q: q || undefined,
    clase: clase !== 'todas' ? clase : undefined,
    categoria: categoria || undefined,
    margen: margen !== 'todos' ? margen : undefined,
    orden: orden !== 'ingresos' ? orden : undefined,
    mostrar: perPage !== DEFAULT_PAGE_SIZE ? String(perPage) : undefined,
    comunas: allComunas ? 'todas' : undefined,
  };
  // Las barras de categoría llevan a la tabla filtrada por esa categoría.
  const slugByCategoryName = new Map(categoryOptions.map(([slug, name]) => [name.toLowerCase(), slug]));

  if (!d.hasData) {
    return (
      <IntelligencePlaceholder
        icon="sliders"
        title="Métricas"
        description="KPIs mensuales y anuales, márgenes por producto y categoría, clasificación ABC y ventas por comuna."
        phase="Fase 1 · Analítica descriptiva"
        count={0}
        countLabel="métricas calculadas"
      />
    );
  }

  return (
    <div className="space-y-9">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Métricas</h1>
          <p className="editorial mt-1 text-[15px] text-taupe">Cómo se está moviendo la tienda</p>
        </div>
        {d.lastUpdated && (
          <p className="text-xs text-taupe">
            Actualizado {new Date(d.lastUpdated).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
      </header>

      {/* Alertas automáticas: cada una lleva a la sección donde se resuelve */}
      {alerts.length > 0 && (
        <section className="space-y-2" aria-label="Alertas">
          {alerts.map((a, i) => (
            <Link
              key={i}
              href={a.href}
              className={`group flex items-center gap-2.5 rounded-chip border px-4 py-2.5 text-sm transition hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/30 ${
                a.level === 'critical' ? 'border-alert/30 bg-alert/[0.08] text-alert'
                : a.level === 'warning' ? 'border-rust/30 bg-rust/[0.10] text-rust-ink'
                : 'border-sand bg-cream text-taupe'
              }`}
            >
              {/* En teléfono el nivel va sobre el mensaje para que el texto use todo el ancho */}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wide">{a.level === 'critical' ? 'Crítico' : a.level === 'warning' ? 'Atención' : 'Info'}</span>
                <span className="text-soot">{a.message}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium opacity-80 group-hover:opacity-100">
                Ver
                <Icon name="chevronR" size={14} />
              </span>
            </Link>
          ))}
        </section>
      )}

      {/* Tarjetas — últimos 12 meses cerrados. Los desgloses de abajo usan la misma ventana. */}
      <section className="space-y-3">
        <Eyebrow>
          Últimos 12 meses cerrados
          {d.windowStart && d.windowEnd && ` · ${monthLabel(d.windowStart)} a ${monthLabel(d.windowEnd)}`}
        </Eyebrow>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Ventas de productos" value={clp(d.totals.revenue)} hint="Sin envío ni órdenes canceladas" />
          <Stat label="Margen" value={clp(d.totals.margin)} hint={`${pct(d.totals.marginPct)} sobre lo vendido con costo conocido`} accent />
          <Stat label="Órdenes" value={num(d.totals.orders)} />
          <Stat label="Ticket promedio" value={clp(d.totals.aov)} />
        </div>
      </section>

      {/* Ingresos por mes */}
      <section className="card-hs shadow-soft p-6">
        <Eyebrow>Ingresos por mes</Eyebrow>
        <div className="mt-5"><MonthlyBars monthly={d.monthly} /></div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card-hs shadow-soft p-6">
          <Eyebrow>Margen por categoría · 12 meses</Eyebrow>
          <p className="mt-1.5 text-[13px] text-taupe">Toca una categoría para ver sus productos en la clasificación ABC.</p>
          <div className="mt-5">
            <CategoryBars
              rows={d.categories}
              hrefFor={(name) => {
                const slug = slugByCategoryName.get(name.toLowerCase());
                return slug ? `${hrefWith(BASE, { ...params, categoria: undefined, pagina: undefined }, { categoria: slug })}#abc` : null;
              }}
            />
          </div>
        </section>

        <section className="card-hs shadow-soft p-6">
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow>Ventas por comuna · 12 meses</Eyebrow>
            {d.communes.length > TOP_COMUNAS && (
              <Link
                href={`${hrefWith(BASE, params, { comunas: allComunas ? undefined : 'todas' })}#comunas`}
                scroll={false}
                className="text-xs font-medium text-rust-ink hover:underline"
              >
                {allComunas ? `Mostrar solo las ${TOP_COMUNAS} principales` : `Mostrar todas (${d.communes.length})`}
              </Link>
            )}
          </div>
          <div id="comunas" className="mt-5 scroll-mt-6">
            <CommuneBars rows={allComunas ? d.communes : d.communes.slice(0, TOP_COMUNAS)} />
          </div>
        </section>
      </div>

      {/* Clasificación ABC */}
      <section id="abc" className="card-hs shadow-soft scroll-mt-6 p-6">
        <Eyebrow>Clasificación ABC de productos · 12 meses</Eyebrow>
        <p className="mt-1.5 text-[13px] text-taupe">
          Regla de Pareto por ingresos — <span className="text-soot">A</span> concentra ~80%,
          {' '}<span className="text-soot">B</span> el siguiente ~15%,
          {' '}<span className="text-soot">C</span> el resto.
        </p>
        <div className="mt-5">
          <ListToolbar
            basePath={BASE}
            query={q}
            perPage={perPage}
            searchLabel="Buscar producto"
            placeholder="Nombre o categoría"
            clearable={isFiltered}
            filters={[
              {
                name: 'clase',
                label: 'Mostrar solo',
                value: clase,
                options: [
                  { value: 'todas', label: 'Todas las clases' },
                  { value: 'A', label: 'Clase A' },
                  { value: 'B', label: 'Clase B' },
                  { value: 'C', label: 'Clase C' },
                ],
              },
              {
                name: 'categoria',
                label: 'Categoría',
                value: categoria,
                options: [{ value: '', label: 'Todas' }, ...categoryOptions.map(([slug, name]) => ({ value: slug, label: name }))],
              },
              {
                name: 'margen',
                label: 'Costo',
                value: margen,
                options: [
                  { value: 'todos', label: 'Todos' },
                  { value: 'con-costo', label: 'Con costo cargado' },
                  { value: 'sin-costo', label: 'Sin costo (sin margen)' },
                ],
              },
              {
                name: 'orden',
                label: 'Ordenar por',
                value: orden,
                options: [
                  { value: 'ingresos', label: 'Ingresos' },
                  { value: 'unidades', label: 'Unidades' },
                  { value: 'margen', label: 'Margen ($)' },
                  { value: 'margen-pct', label: 'Margen (%)' },
                  { value: 'nombre', label: 'Nombre' },
                ],
              },
            ]}
          />
          <p className="mb-3 text-[13px] text-taupe" aria-live="polite">
            {filtered.length === 0
              ? 'Ningún producto coincide con estos filtros.'
              : `${num(filtered.length)} ${filtered.length === 1 ? 'producto' : 'productos'} · ${clp(filteredRevenue)} en ingresos`}
            {isFiltered && filtered.length > 0 && totalRevenue > 0 && ` (${((filteredRevenue / totalRevenue) * 100).toFixed(1)}% del total)`}
          </p>
          {filtered.length > 0 && <AbcTable rows={pageRows} />}
          <PanelPagination basePath={BASE} params={params} info={info} noun={['producto', 'productos']} />
        </div>
      </section>

      {anomalies.hasData && (
        <section className="card-hs shadow-soft p-6">
          <Eyebrow>Anomalías de ventas</Eyebrow>
          <p className="mt-1.5 text-[13px] text-taupe">
            Días de los últimos 6 meses que se salen mucho de lo normal para ese día de la semana (z-score ≥ 2,5).
            No incluye fechas que ya se sabe que venden más: Fiestas Patrias, Navidad, CyberDay.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {anomalies.anomalies.map((a, i) => (
              <span key={i} className={`chip-hs ${a.deviation > 0 ? 'border-transparent bg-mint text-[#3F664D]' : 'border-transparent bg-alert/[0.12] text-alert'}`}>
                {new Date(a.date).toLocaleDateString('es-CL', { timeZone: 'UTC' })} · {clp(a.revenue)} (normal {clp(a.expected)}) {a.deviation > 0 ? '▲' : '▼'}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <h2 className="editorial text-[15px] text-taupe">{children}</h2>;
}

function MonthlyBars({ monthly }: { monthly: MetricPoint[] }) {
  const max = Math.max(...monthly.map((m) => m.revenue), 1);
  return (
    <div>
      <div className="flex h-44 items-end gap-[3px]">
        {monthly.map((m) => {
          const month = new Date(m.periodStart).getUTCMonth();
          const peak = month === 8 || month === 11; // sep / dic
          return (
            <div key={m.periodStart.toISOString()} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className={`w-full rounded-t-[3px] ${peak ? 'bg-rust' : 'bg-tan'} transition group-hover:brightness-95`}
                style={{ height: `${(m.revenue / max) * 100}%` }}
              />
              <div className="price-mono pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-chip bg-soot px-2 py-1 text-[11px] text-snow group-hover:block">
                {monthLabel(m.periodStart)} · {clp(m.revenue)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-taupe">
        <span>{monthLabel(monthly[0]!.periodStart)}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-[2px] bg-rust" /> peaks: septiembre y diciembre
        </span>
        <span>{monthLabel(monthly.at(-1)!.periodStart)}</span>
      </div>
    </div>
  );
}

function CategoryBars({ rows, hrefFor }: { rows: CategoryRow[]; hrefFor: (name: string) => string | null }) {
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.category}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            {hrefFor(r.category) ? (
              <Link href={hrefFor(r.category)!} className="font-semibold capitalize text-soot underline-offset-2 hover:text-rust-ink hover:underline">
                {r.category}
              </Link>
            ) : (
              <span className="font-semibold capitalize text-soot">{r.category}</span>
            )}
            <span className="text-taupe">
              <span className="price-mono text-soot">{clp(r.revenue)}</span>
              {'  ·  margen '}<span className="text-rust-ink">{pct(r.marginPct)}</span>
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-chip bg-sand">
            <div className="h-full rounded-chip bg-rust" style={{ width: `${(r.revenue / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CommuneBars({ rows }: { rows: CommuneRow[] }) {
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.commune} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-soot" title={r.commune}>{r.commune}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-chip bg-sand">
            <div className="h-full rounded-chip bg-tan-mid" style={{ width: `${(r.revenue / max) * 100}%` }} />
          </div>
          <span className="price-mono w-16 shrink-0 text-right text-[13px] text-taupe">{clpShort(r.revenue)}</span>
        </div>
      ))}
    </div>
  );
}

function AbcTable({ rows }: { rows: ProductRow[] }) {
  const badge = (c: 'A' | 'B' | 'C') =>
    c === 'A' ? 'bg-mint text-[#3F664D]' : c === 'B' ? 'bg-rust/[0.16] text-rust-ink' : 'bg-sand text-taupe';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-sand text-left text-taupe">
            <th className="py-2 pr-3 text-[13px] font-semibold">Clase</th>
            <th className="py-2 pr-3 text-[13px] font-semibold">Producto</th>
            <th className="py-2 pr-3 text-right text-[13px] font-semibold">Ingresos</th>
            <th className="py-2 pr-3 text-right text-[13px] font-semibold">Unidades</th>
            <th className="py-2 text-right text-[13px] font-semibold">Margen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.productId} className="border-b border-sand/60 last:border-0">
              <td className="py-2.5 pr-3">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-chip text-xs font-bold ${badge(p.abc)}`}>{p.abc}</span>
              </td>
              <td className="py-2.5 pr-3 text-soot">{p.name}</td>
              <td className="price-mono py-2.5 pr-3 text-right text-soot">{clp(p.revenue)}</td>
              <td className="price-mono py-2.5 pr-3 text-right text-taupe">{num(p.units)}</td>
              <td className="py-2.5 text-right text-rust-ink">{pct(p.marginPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
