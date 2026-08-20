import { getModelRuns } from '@/src/lib/services/intelligence.service';
import IntelligencePlaceholder from '@/src/components/panel/IntelligencePlaceholder';
import { PageHeader, Eyebrow, Stat, num, pct } from '@/src/components/panel/intelligence-ui';

export const revalidate = 60;

const MODEL_NAMES: Record<string, string> = {
  kpi_snapshots: 'KPIs descriptivos',
  demand_forecast: 'Forecast de demanda',
  restock: 'Reposición',
  market_basket: 'Recomendador',
  rfm: 'Segmentación RFM',
  fraud: 'Fraude en órdenes',
  account_takeover: 'Account takeover',
  smoke_test: 'Prueba de pipeline',
};

function statusChip(status: string) {
  if (status === 'SUCCESS') return 'chip-mint';
  if (status === 'FAILED') return 'chip-blush';
  return 'chip-hs';
}

export default async function ModelosPage() {
  const d = await getModelRuns();

  if (!d.hasData) {
    return (
      <IntelligencePlaceholder
        icon="settings"
        title="Modelos"
        description="Historial y trazabilidad de cada entrenamiento: versión, estado, métricas y duración."
        phase="Fase 5 · Gobernanza"
        count={0}
        countLabel="corridas registradas"
      />
    );
  }

  return (
    <div className="space-y-9">
      <PageHeader title="Modelos" subtitle="Trazabilidad y salud del pipeline de ML" updated={d.rows[0]?.finishedAt} />

      <section className="space-y-3">
        <Eyebrow>Estado del pipeline</Eyebrow>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat label="Modelos activos" value={num(d.latest.length)} />
          <Stat label="Corridas registradas" value={num(d.rows.length)} hint="últimas 40" />
          <Stat label="Tasa de éxito" value={pct(d.successRate)} accent />
        </div>
      </section>

      <section className="card-hs shadow-soft p-6">
        <Eyebrow>Última corrida por modelo</Eyebrow>
        <p className="mt-1.5 text-[13px] text-taupe">Cada predicción del panel referencia una de estas corridas — auditable de punta a punta.</p>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          {d.latest.map((r) => (
            <div key={r.modelType} className="rounded-chip border border-sand bg-cream p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-soot">{MODEL_NAMES[r.modelType] ?? r.modelType}</span>
                <span className={statusChip(r.status)}>v{r.version}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-taupe">
                {r.metrics && Object.entries(r.metrics).filter(([k]) => k !== 'distribucion').slice(0, 4).map(([k, v]) => (
                  <span key={k}><span className="text-soot">{k}:</span> <span className="price-mono">{String(v)}</span></span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card-hs shadow-soft p-6">
        <Eyebrow>Historial de corridas</Eyebrow>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-taupe">
                <th className="py-2 pr-3 text-[13px] font-semibold">Modelo</th>
                <th className="py-2 pr-3 text-[13px] font-semibold">Versión</th>
                <th className="py-2 pr-3 text-[13px] font-semibold">Estado</th>
                <th className="py-2 pr-3 text-right text-[13px] font-semibold">Filas</th>
                <th className="py-2 pr-3 text-right text-[13px] font-semibold">Duración</th>
                <th className="py-2 text-[13px] font-semibold">Cuándo</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r, i) => (
                <tr key={i} className="border-b border-sand/60 last:border-0">
                  <td className="py-2.5 pr-3 text-soot">{MODEL_NAMES[r.modelType] ?? r.modelType}</td>
                  <td className="price-mono py-2.5 pr-3 text-taupe">v{r.version}</td>
                  <td className="py-2.5 pr-3"><span className={statusChip(r.status)}>{r.status}</span></td>
                  <td className="price-mono py-2.5 pr-3 text-right text-taupe">{r.rowsIn != null ? num(r.rowsIn) : '—'}</td>
                  <td className="price-mono py-2.5 pr-3 text-right text-taupe">{r.durationSec != null ? `${r.durationSec.toFixed(1)}s` : '—'}</td>
                  <td className="py-2.5 text-taupe">{new Date(r.startedAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
