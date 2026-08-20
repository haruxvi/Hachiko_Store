import { getDemandForecast, getProductTrends } from '@/src/lib/services/intelligence.service';
import IntelligencePlaceholder from '@/src/components/panel/IntelligencePlaceholder';
import { PageHeader, Eyebrow, Stat, num, pct, monthLabel } from '@/src/components/panel/intelligence-ui';

export const revalidate = 60;

export default async function DemandaPage() {
  const [d, trends] = await Promise.all([getDemandForecast(), getProductTrends()]);

  if (!d.hasData) {
    return (
      <IntelligencePlaceholder
        icon="arrow"
        title="Demanda"
        description="Pronóstico de demanda por producto con estacionalidad, para anticipar las compras."
        phase="Fase 2 · Núcleo predictivo"
        count={0}
        countLabel="pronósticos"
      />
    );
  }

  const nextLabel = d.products[0]?.points[0] ? monthLabel(d.products[0].points[0].periodStart) : '';

  return (
    <div className="space-y-9">
      <PageHeader title="Demanda" subtitle="Lo que viene, para comprar a tiempo" updated={d.lastUpdated} />

      <section className="space-y-3">
        <Eyebrow>Resumen del pronóstico</Eyebrow>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat label={`Unidades previstas · ${nextLabel}`} value={num(d.totalNextMonth)} accent />
          <Stat label="Productos pronosticados" value={num(d.products.length)} />
          <Stat label="Error medio del modelo" value={d.mae != null ? `${d.mae} uds/mes` : '—'} hint="Ridge con estacionalidad" />
        </div>
      </section>

      <section className="card-hs shadow-soft p-6">
        <Eyebrow>Pronóstico por producto</Eyebrow>
        <p className="mt-1.5 text-[13px] text-taupe">
          Ordenado por demanda del próximo mes. Cuando el pronóstico supera el stock actual, se marca el riesgo de quiebre.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-taupe">
                <th className="py-2 pr-3 text-[13px] font-semibold">Producto</th>
                <th className="py-2 pr-3 text-right text-[13px] font-semibold">{nextLabel}</th>
                <th className="py-2 pr-3 text-right text-[13px] font-semibold">Rango</th>
                <th className="py-2 pr-3 text-right text-[13px] font-semibold">Stock</th>
                <th className="py-2 text-right text-[13px] font-semibold">Señal</th>
              </tr>
            </thead>
            <tbody>
              {d.products.map((p) => {
                const pt = p.points[0];
                const risk = pt ? pt.predicted > p.stock : false;
                return (
                  <tr key={p.productId} className="border-b border-sand/60 last:border-0">
                    <td className="py-2.5 pr-3 text-soot">{p.name}</td>
                    <td className="price-mono py-2.5 pr-3 text-right text-soot">{num(pt?.predicted ?? 0)}</td>
                    <td className="price-mono py-2.5 pr-3 text-right text-taupe">{num(pt?.lower ?? 0)}–{num(pt?.upper ?? 0)}</td>
                    <td className="price-mono py-2.5 pr-3 text-right text-taupe">{num(p.stock)}</td>
                    <td className="py-2.5 text-right">
                      {risk
                        ? <span className="chip-hs border-transparent bg-rust/[0.16] text-[#b06a2c]">riesgo de quiebre</span>
                        : <span className="chip-mint">ok</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {trends.hasData && (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="card-hs shadow-soft p-6">
            <Eyebrow>Productos en alza</Eyebrow>
            <p className="mt-1.5 text-[13px] text-taupe">Últimos 90 días vs. los 90 anteriores.</p>
            <ul className="mt-4 space-y-2 text-sm">
              {trends.rising.map((t) => (
                <li key={t.name} className="flex justify-between border-b border-sand/60 pb-1.5 last:border-0">
                  <span className="text-soot">{t.name}</span>
                  <span className="price-mono text-mint-deep">▲ {pct(t.growth)}</span>
                </li>
              ))}
              {trends.rising.length === 0 && <li className="text-taupe">Sin productos en alza clara.</li>}
            </ul>
          </div>
          <div className="card-hs shadow-soft p-6">
            <Eyebrow>Productos en baja</Eyebrow>
            <p className="mt-1.5 text-[13px] text-taupe">Caída de demanda — revisar precio o promoción.</p>
            <ul className="mt-4 space-y-2 text-sm">
              {trends.declining.map((t) => (
                <li key={t.name} className="flex justify-between border-b border-sand/60 pb-1.5 last:border-0">
                  <span className="text-soot">{t.name}</span>
                  <span className="price-mono text-alert">▼ {pct(Math.abs(t.growth))}</span>
                </li>
              ))}
              {trends.declining.length === 0 && <li className="text-taupe">Sin productos en baja clara.</li>}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
