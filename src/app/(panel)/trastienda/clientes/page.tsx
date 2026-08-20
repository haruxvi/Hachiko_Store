import { getCustomerSegments, getCustomerValue } from '@/src/lib/services/intelligence.service';
import IntelligencePlaceholder from '@/src/components/panel/IntelligencePlaceholder';
import { PageHeader, Eyebrow, Stat, clp, num, pct } from '@/src/components/panel/intelligence-ui';

export const revalidate = 60;

// Etiquetas legibles + una pista de qué hacer con cada segmento.
const LABELS: Record<string, { name: string; hint: string }> = {
  champions: { name: 'Campeones', hint: 'compran seguido y reciente — cuídalos' },
  leales: { name: 'Leales', hint: 'base sólida — fidelízalos' },
  nuevos: { name: 'Nuevos', hint: 'recién llegan — engánchalos' },
  prometedores: { name: 'Prometedores', hint: 'potencial de crecer' },
  en_riesgo: { name: 'En riesgo', hint: 'compraban y se enfriaron — reactívalos' },
  hibernando: { name: 'Hibernando', hint: 'inactivos — campaña de recuperación' },
};

export default async function ClientesPage() {
  const [d, value] = await Promise.all([getCustomerSegments(), getCustomerValue()]);

  if (!d.hasData) {
    return (
      <IntelligencePlaceholder
        icon="eye"
        title="Clientes"
        description="Segmentación RFM (recencia, frecuencia, monto) con clustering, para saber a quién cuidar y a quién reactivar."
        phase="Fase 2 · Núcleo predictivo"
        count={0}
        countLabel="clientes segmentados"
      />
    );
  }

  const max = Math.max(...d.segments.map((s) => s.count), 1);

  return (
    <div className="space-y-9">
      <PageHeader title="Clientes" subtitle="Quién compra cómo — segmentación RFM" updated={d.lastUpdated} />

      <section className="space-y-3">
        <Eyebrow>Resumen</Eyebrow>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Clientes segmentados" value={num(d.total)} />
          <Stat label="Valor de vida promedio" value={clp(value.avgClv)} accent hint="CLV histórico por cliente" />
          <Stat label="Segmentos" value={num(d.segments.length)} />
          <Stat label="Cohesión (silhouette)" value={d.silhouette != null ? d.silhouette.toFixed(3) : '—'} hint="clustering KMeans" />
        </div>
      </section>

      <section className="card-hs shadow-soft p-6">
        <Eyebrow>Distribución por segmento</Eyebrow>
        <p className="mt-1.5 text-[13px] text-taupe">Recencia / Frecuencia / Monto promedio de cada grupo (1 = bajo, 5 = alto).</p>
        <div className="mt-5 space-y-4">
          {d.segments.map((s) => {
            const meta = LABELS[s.segment] ?? { name: s.segment, hint: '' };
            return (
              <div key={s.segment}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <div>
                    <span className="font-semibold text-soot">{meta.name}</span>
                    <span className="ml-2 text-xs text-taupe">{meta.hint}</span>
                  </div>
                  <span className="text-taupe">
                    <span className="price-mono text-soot">{num(s.count)}</span> ({pct(s.count / d.total)})
                    <span className="ml-3 price-mono text-xs">R{s.avgR.toFixed(1)} · F{s.avgF.toFixed(1)} · M{s.avgM.toFixed(1)}</span>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-chip bg-sand">
                  <div className="h-full rounded-chip bg-rust" style={{ width: `${(s.count / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
