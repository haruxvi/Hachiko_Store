import { getFraudRisk, getAccountRisk, getIncidentAnalytics } from '@/src/lib/services/intelligence.service';
import IntelligencePlaceholder from '@/src/components/panel/IntelligencePlaceholder';
import { PageHeader, Eyebrow, Stat, clp, num } from '@/src/components/panel/intelligence-ui';

export const revalidate = 60;

export default async function RiesgoPage() {
  const [d, acc, inc] = await Promise.all([getFraudRisk(), getAccountRisk(), getIncidentAnalytics()]);

  if (!d.hasData && !acc.hasData && !inc.hasData) {
    return (
      <IntelligencePlaceholder
        icon="bell"
        title="Riesgo"
        description="Detección de órdenes atípicas con machine learning, para revisar posibles fraudes antes de despachar."
        phase="Fase 3 · Seguridad inteligente"
        count={0}
        countLabel="órdenes marcadas"
      />
    );
  }

  return (
    <div className="space-y-9">
      <PageHeader title="Riesgo" subtitle="Señales de fraude y ataques, para revisión humana" updated={d.lastUpdated ?? acc.lastUpdated} />

      {acc.hasData && (
        <section className="card-hs shadow-soft border-alert/30 p-6">
          <Eyebrow>Cuentas bajo ataque</Eyebrow>
          <p className="mt-1.5 text-[13px] text-taupe">
            {num(acc.flagged)} cuentas marcadas · {num(acc.stuffingIps)} IP(s) de credential stuffing detectadas.
            Se muestra un identificador pseudónimo (sin exponer datos del cliente).
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand text-left text-taupe">
                  <th className="py-2 pr-3 text-[13px] font-semibold">Cuenta</th>
                  <th className="py-2 pr-3 text-[13px] font-semibold">Señales</th>
                  <th className="py-2 text-right text-[13px] font-semibold">Riesgo</th>
                </tr>
              </thead>
              <tbody>
                {acc.rows.slice(0, 40).map((r) => (
                  <tr key={r.ref} className="border-b border-sand/60 align-top last:border-0">
                    <td className="price-mono py-2.5 pr-3 text-soot">···{r.ref}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap gap-1.5">
                        {r.reasons.map((reason, i) => (
                          <span key={i} className="chip-hs border-transparent bg-rust/[0.16] text-[#b06a2c]">{reason}</span>
                        ))}
                      </div>
                    </td>
                    <td className="price-mono py-2.5 text-right font-semibold text-alert">{(r.score * 100).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {d.hasData && (
      <section className="space-y-3">
        <Eyebrow>Órdenes atípicas</Eyebrow>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat label="Órdenes marcadas" value={num(d.flagged)} accent />
          <Stat label="Órdenes analizadas" value={num(d.totalOrders)} />
          <Stat label="Tasa de revisión" value={`${((d.flagged / Math.max(1, d.totalOrders)) * 100).toFixed(1)}%`} hint="Isolation Forest no supervisado" />
        </div>
      </section>
      )}

      {d.hasData && (
      <section className="card-hs shadow-soft p-6">
        <Eyebrow>Órdenes a revisar</Eyebrow>
        <p className="mt-1.5 text-[13px] text-taupe">
          Ordenadas por riesgo. El modelo <span className="text-soot">sugiere</span> revisión — la decisión final es humana.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-taupe">
                <th className="py-2 pr-3 text-[13px] font-semibold">Orden</th>
                <th className="py-2 pr-3 text-right text-[13px] font-semibold">Monto</th>
                <th className="py-2 pr-3 text-[13px] font-semibold">Fecha</th>
                <th className="py-2 pr-3 text-[13px] font-semibold">Señales</th>
                <th className="py-2 text-right text-[13px] font-semibold">Riesgo</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.slice(0, 60).map((r) => (
                <tr key={r.orderId} className="border-b border-sand/60 last:border-0 align-top">
                  <td className="price-mono py-2.5 pr-3 text-soot">#{r.orderNumber ?? '—'}</td>
                  <td className="price-mono py-2.5 pr-3 text-right text-soot">{clp(r.total)}</td>
                  <td className="py-2.5 pr-3 text-taupe">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-CL') : '—'}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap gap-1.5">
                      {r.reasons.map((reason, i) => (
                        <span key={i} className="chip-hs border-transparent bg-rust/[0.16] text-[#b06a2c]">{reason}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="price-mono font-semibold text-alert">{(r.score * 100).toFixed(0)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {inc.hasData && (
        <section className="card-hs shadow-soft p-6">
          <Eyebrow>Incidentes de seguridad</Eyebrow>
          <p className="mt-1.5 text-[13px] text-taupe">Tendencias del registro de incidentes (Leyes 21.459 / 21.663 / 21.719).</p>
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Total" value={num(inc.total)} />
            <Stat label="Abiertos" value={num(inc.open)} accent />
            <Stat label="Afectan datos personales" value={num(inc.affectsPersonalData)} />
            <Stat label="MTTR" value={inc.mttrHours != null ? `${inc.mttrHours.toFixed(0)} h` : '—'} hint="tiempo medio de resolución" />
          </div>
          <div className="mt-6">
            <p className="mb-3 text-[13px] text-taupe">Por categoría</p>
            <div className="space-y-2.5">
              {inc.byCategory.map((c) => {
                const max = Math.max(...inc.byCategory.map((x) => x.count), 1);
                return (
                  <div key={c.category} className="flex items-center gap-3 text-sm">
                    <span className="w-52 shrink-0 truncate text-soot" title={c.category}>{c.category}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-chip bg-sand">
                      <div className="h-full rounded-chip bg-tan-mid" style={{ width: `${(c.count / max) * 100}%` }} />
                    </div>
                    <span className="price-mono w-8 shrink-0 text-right text-taupe">{c.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
