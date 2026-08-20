import { getConversionAnalytics } from '@/src/lib/services/intelligence.service';
import IntelligencePlaceholder from '@/src/components/panel/IntelligencePlaceholder';
import { PageHeader, Eyebrow, Stat, num, pct } from '@/src/components/panel/intelligence-ui';

export const revalidate = 60;

export default async function ConversionPage() {
  const d = await getConversionAnalytics();

  if (!d.hasData) {
    return (
      <IntelligencePlaceholder
        icon="filter"
        title="Conversión"
        description="Embudo de compra, carritos abandonados y búsquedas sin resultado, para tapar las fugas de venta."
        phase="Fase 4 · Cliente y conversión"
        count={0}
        countLabel="eventos de navegación"
      />
    );
  }

  const top = d.funnel[0]?.sessions ?? 1;

  return (
    <div className="space-y-9">
      <PageHeader title="Conversión" subtitle="Dónde se pierden las ventas en el camino" updated={null} />

      <section className="space-y-3">
        <Eyebrow>Resumen</Eyebrow>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat label="Conversión general" value={pct(d.overallConversion)} accent hint="de vista de producto a compra" />
          <Stat label="Carritos abandonados" value={num(d.abandoned)} />
          <Stat label="Recuperables (con cuenta)" value={num(d.recoverable)} hint="respetando consentimiento" />
        </div>
      </section>

      <section className="card-hs shadow-soft p-6">
        <Eyebrow>Embudo de conversión</Eyebrow>
        <div className="mt-5 space-y-3">
          {d.funnel.map((f, i) => {
            const prev = i > 0 ? d.funnel[i - 1]!.sessions : f.sessions;
            const dropVsPrev = i > 0 && prev > 0 ? 1 - f.sessions / prev : 0;
            return (
              <div key={f.stage}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-soot">{f.stage}</span>
                  <span className="text-taupe">
                    <span className="price-mono text-soot">{num(f.sessions)}</span>
                    {i > 0 && <span className="ml-3 text-xs text-alert">−{pct(dropVsPrev)}</span>}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-chip bg-sand">
                  <div className="h-full rounded-chip bg-rust" style={{ width: `${(f.sessions / top) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card-hs shadow-soft p-6">
        <Eyebrow>Búsquedas sin resultado</Eyebrow>
        <p className="mt-1.5 text-[13px] text-taupe">Demanda insatisfecha — lo que la gente busca y no encuentra en tu catálogo.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {d.noResultSearches.length === 0
            ? <p className="text-sm text-taupe">Sin búsquedas fallidas registradas.</p>
            : d.noResultSearches.map((s) => (
              <span key={s.query} className="chip-hs">
                {s.query}<span className="price-mono ml-1.5 text-rust-dark">{s.count}</span>
              </span>
            ))}
        </div>
      </section>
    </div>
  );
}
