import {
  getMetricsDashboard,
  getAlerts,
  getSalesAnomalies,
  type MetricPoint,
  type CategoryRow,
  type ProductRow,
  type CommuneRow,
} from '@/src/lib/services/intelligence.service';
import IntelligencePlaceholder from '@/src/components/panel/IntelligencePlaceholder';

export const revalidate = 60;

const clp = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Math.round(n));
const clpShort = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const num = (n: number) => n.toLocaleString('es-CL');
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const monthLabel = (d: Date) => `${MONTHS_ES[new Date(d).getMonth()]} ${new Date(d).getFullYear()}`;

export default async function MetricasPage() {
  const [d, alerts, anomalies] = await Promise.all([getMetricsDashboard(), getAlerts(), getSalesAnomalies()]);

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

      {/* Alertas automáticas (KPI fuera de rango) */}
      {alerts.length > 0 && (
        <section className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-center gap-2.5 rounded-chip border px-4 py-2.5 text-sm ${
                a.level === 'critical' ? 'border-alert/30 bg-alert/[0.08] text-alert'
                : a.level === 'warning' ? 'border-rust/30 bg-rust/[0.10] text-[#b06a2c]'
                : 'border-sand bg-cream text-taupe'
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-wide">{a.level === 'critical' ? 'Crítico' : a.level === 'warning' ? 'Atención' : 'Info'}</span>
              <span className="text-soot">{a.message}</span>
            </div>
          ))}
        </section>
      )}

      {/* Tarjetas — últimos 12 meses */}
      <section className="space-y-3">
        <Eyebrow>Últimos doce meses</Eyebrow>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Ingresos" value={clp(d.totals.revenue)} />
          <Stat label="Margen" value={clp(d.totals.margin)} hint={`${pct(d.totals.marginPct)} sobre ingresos`} accent />
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
          <Eyebrow>Margen por categoría</Eyebrow>
          <div className="mt-5"><CategoryBars rows={d.categories} /></div>
        </section>

        <section className="card-hs shadow-soft p-6">
          <Eyebrow>Ventas por comuna</Eyebrow>
          <div className="mt-5"><CommuneBars rows={d.communes.slice(0, 10)} /></div>
        </section>
      </div>

      {/* Clasificación ABC */}
      <section className="card-hs shadow-soft p-6">
        <Eyebrow>Clasificación ABC de productos</Eyebrow>
        <p className="mt-1.5 text-[13px] text-taupe">
          Regla de Pareto por ingresos — <span className="text-soot">A</span> concentra ~80%,
          {' '}<span className="text-soot">B</span> el siguiente ~15%,
          {' '}<span className="text-soot">C</span> el resto.
        </p>
        <div className="mt-5"><AbcTable rows={d.products} /></div>
      </section>

      {anomalies.hasData && (
        <section className="card-hs shadow-soft p-6">
          <Eyebrow>Anomalías de ventas</Eyebrow>
          <p className="mt-1.5 text-[13px] text-taupe">Días cuyos ingresos se desvían mucho de lo normal (z-score ≥ 2,5) — picos o caídas a investigar.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {anomalies.anomalies.map((a, i) => (
              <span key={i} className={`chip-hs ${a.deviation > 0 ? 'border-transparent bg-mint text-[#4e7a5e]' : 'border-transparent bg-alert/[0.12] text-alert'}`}>
                {new Date(a.date).toLocaleDateString('es-CL')} · {clp(a.revenue)} {a.deviation > 0 ? '▲' : '▼'}
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

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="card-hs shadow-soft p-5">
      <p className="text-[13px] text-taupe">{label}</p>
      <p className={`price-mono mt-1.5 text-[25px] leading-none ${accent ? 'text-rust-dark' : 'text-soot'}`}>{value}</p>
      {hint && <p className="mt-2 text-xs text-taupe">{hint}</p>}
    </div>
  );
}

function MonthlyBars({ monthly }: { monthly: MetricPoint[] }) {
  const max = Math.max(...monthly.map((m) => m.revenue), 1);
  return (
    <div>
      <div className="flex h-44 items-end gap-[3px]">
        {monthly.map((m) => {
          const month = new Date(m.periodStart).getMonth();
          const peak = month === 8 || month === 11; // sep / dic
          return (
            <div key={m.periodStart.toISOString()} className="group relative flex flex-1 flex-col justify-end">
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

function CategoryBars({ rows }: { rows: CategoryRow[] }) {
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.category}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold capitalize text-soot">{r.category}</span>
            <span className="text-taupe">
              <span className="price-mono text-soot">{clp(r.revenue)}</span>
              {'  ·  margen '}<span className="text-rust-dark">{pct(r.marginPct)}</span>
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
    c === 'A' ? 'bg-mint text-[#4e7a5e]' : c === 'B' ? 'bg-rust/[0.16] text-[#b06a2c]' : 'bg-sand text-taupe';
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
              <td className="py-2.5 text-right text-rust-dark">{pct(p.marginPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
