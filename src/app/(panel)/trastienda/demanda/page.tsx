import Link from 'next/link';
import { getDemandForecast, getProductTrends, getExpectedProfit } from '@/src/lib/services/intelligence.service';
import IntelligencePlaceholder from '@/src/components/panel/IntelligencePlaceholder';
import { PageHeader, Eyebrow, Stat, clp, num, pct, monthLabel } from '@/src/components/panel/intelligence-ui';
import {
  FORECAST_PERIODS,
  parsePeriod,
  scaleToPeriod,
  formatUnits,
  type ForecastPeriod,
} from '@/src/lib/forecast-period';

export const dynamic = 'force-dynamic';

type Params = { profitPeriod?: string; unitsPeriod?: string; tablePeriod?: string };

const SHORT: Record<ForecastPeriod, string> = { day: 'Día', week: 'Sem.', month: 'Mes' };
const PER: Record<ForecastPeriod, string> = { day: 'por día', week: 'por semana', month: 'del mes' };

export default async function DemandaPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const profitPeriod = parsePeriod(params.profitPeriod);
  const unitsPeriod = parsePeriod(params.unitsPeriod);
  const tablePeriod = parsePeriod(params.tablePeriod);

  // Una sola lectura del pronóstico: las tres vistas derivan del mismo dato mensual.
  const [forecast, trends, profit] = await Promise.all([
    getDemandForecast(),
    getProductTrends(),
    getExpectedProfit(),
  ]);

  if (!forecast.hasData) {
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

  // El mes que realmente pronosticó el modelo (no "hoy + 1 mes": si el modelo
  // corrió antes, ambos difieren y la etiqueta mentiría).
  const firstPoint = forecast.products[0]?.points[0];
  const forecastMonth = firstPoint ? monthLabel(firstPoint.periodStart) : '';

  const totalUnits = forecast.products.reduce((sum, p) => {
    const pt = p.points[0];
    return pt ? sum + scaleToPeriod(pt.predicted, unitsPeriod, pt.horizonDays) : sum;
  }, 0);

  const hrefWith = (key: keyof Params, value: ForecastPeriod) => {
    const q = new URLSearchParams({ profitPeriod, unitsPeriod, tablePeriod });
    q.set(key, value);
    return `/trastienda/demanda?${q.toString()}`;
  };

  const averageNote = (p: ForecastPeriod) =>
    p === 'month' ? null : `promedio ${PER[p]} derivado del pronóstico mensual`;

  return (
    <div className="space-y-8">
      <PageHeader title="Demanda" subtitle="Lo que viene, para comprar a tiempo" updated={forecast.lastUpdated} />

      <section className="space-y-3">
        <Eyebrow>Resumen del pronóstico · {forecastMonth}</Eyebrow>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="card-hs shadow-soft flex flex-col justify-between p-4">
            <div className="flex items-center justify-between gap-1 border-b border-sand/40 pb-2">
              <span className="truncate text-[12px] font-medium text-taupe">Ganancia esperada {PER[profitPeriod]}</span>
              <PeriodToggle current={profitPeriod} href={(p) => hrefWith('profitPeriod', p)} />
            </div>
            <div className="mt-3">
              <div className="price-mono text-2xl font-semibold tracking-tight text-mint-deep">
                {clp(scaleToPeriod(profit.expectedProfit, profitPeriod, profit.horizonDays))}
              </div>
              <p className="mt-1 text-[11px] text-taupe">
                margen {pct(profit.marginPct)} · ingresos{' '}
                {clp(scaleToPeriod(profit.expectedRevenue, profitPeriod, profit.horizonDays))}
              </p>
              {averageNote(profitPeriod) && <p className="mt-0.5 text-[11px] text-taupe">{averageNote(profitPeriod)}</p>}
            </div>
          </div>

          <div className="card-hs shadow-soft flex flex-col justify-between p-4">
            <div className="flex items-center justify-between gap-1 border-b border-sand/40 pb-2">
              <span className="truncate text-[12px] font-medium text-taupe">Unidades previstas {PER[unitsPeriod]}</span>
              <PeriodToggle current={unitsPeriod} href={(p) => hrefWith('unitsPeriod', p)} />
            </div>
            <div className="mt-3">
              <div className="price-mono text-2xl font-semibold tracking-tight text-soot">
                {formatUnits(totalUnits, unitsPeriod)}
              </div>
              {averageNote(unitsPeriod) && <p className="mt-1 text-[11px] text-taupe">{averageNote(unitsPeriod)}</p>}
            </div>
          </div>

          <Stat label="Productos pronosticados" value={num(forecast.products.length)} />
          <Stat
            label="Error medio del modelo"
            value={forecast.mae != null ? `${forecast.mae} uds/mes` : '—'}
            hint="Ridge con estacionalidad"
          />
        </div>
      </section>

      <section className="card-hs shadow-soft p-6">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>Pronóstico por producto</Eyebrow>
          <PeriodToggle current={tablePeriod} href={(p) => hrefWith('tablePeriod', p)} />
        </div>
        <p className="mt-1 text-[12px] text-taupe">
          Ordenado por demanda estimada. El riesgo de quiebre compara siempre el pronóstico del mes completo con el
          stock actual, sin importar la vista elegida.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-taupe">
                <th className="py-2 pr-3 text-[12px] font-medium">Producto</th>
                <th className="py-2 pr-3 text-right text-[12px] font-medium">
                  {forecastMonth} · {PER[tablePeriod]}
                </th>
                <th className="py-2 pr-3 text-right text-[12px] font-medium">Rango</th>
                <th className="py-2 pr-3 text-right text-[12px] font-medium">Stock</th>
                <th className="py-2 text-right text-[12px] font-medium">Señal</th>
              </tr>
            </thead>
            <tbody>
              {forecast.products.map((p) => {
                const pt = p.points[0];
                // Señal de negocio: pronóstico MENSUAL vs stock. Una vista por día
                // nunca superaría el stock y escondería quiebres reales.
                const risk = pt ? pt.predicted > p.stock : false;
                const show = (q: number) => formatUnits(pt ? scaleToPeriod(q, tablePeriod, pt.horizonDays) : 0, tablePeriod);
                return (
                  <tr key={p.productId} className="border-b border-sand/40 last:border-0 hover:bg-sand/10">
                    <td className="py-2.5 pr-3 font-medium text-soot">{p.name}</td>
                    <td className="price-mono py-2.5 pr-3 text-right text-soot">{show(pt?.predicted ?? 0)}</td>
                    <td className="price-mono py-2.5 pr-3 text-right text-taupe">
                      {show(pt?.lower ?? 0)}–{show(pt?.upper ?? 0)}
                    </td>
                    <td className="price-mono py-2.5 pr-3 text-right text-taupe">{num(p.stock)}</td>
                    <td className="py-2.5 text-right">
                      {risk ? (
                        <span className="chip-hs border-transparent bg-rust/[0.12] text-[11px] text-[#b06a2c]">riesgo de quiebre</span>
                      ) : (
                        <span className="chip-mint text-[11px]">ok</span>
                      )}
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
            <p className="mt-1 text-[12px] text-taupe">Últimos 90 días vs. los 90 anteriores.</p>
            <ul className="mt-4 space-y-2 text-sm">
              {trends.rising.map((t) => (
                <li key={t.name} className="flex justify-between border-b border-sand/40 pb-1.5 last:border-0">
                  <span className="text-soot">{t.name}</span>
                  <span className="price-mono font-medium text-mint-deep">▲ {pct(t.growth)}</span>
                </li>
              ))}
              {trends.rising.length === 0 && <li className="text-xs text-taupe">Sin productos en alza clara.</li>}
            </ul>
          </div>
          <div className="card-hs shadow-soft p-6">
            <Eyebrow>Productos en baja</Eyebrow>
            <p className="mt-1 text-[12px] text-taupe">Caída de demanda — revisar precio o promoción.</p>
            <ul className="mt-4 space-y-2 text-sm">
              {trends.declining.map((t) => (
                <li key={t.name} className="flex justify-between border-b border-sand/40 pb-1.5 last:border-0">
                  <span className="text-soot">{t.name}</span>
                  <span className="price-mono font-medium text-alert">▼ {pct(Math.abs(t.growth))}</span>
                </li>
              ))}
              {trends.declining.length === 0 && <li className="text-xs text-taupe">Sin productos en baja clara.</li>}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function PeriodToggle({ current, href }: { current: ForecastPeriod; href: (p: ForecastPeriod) => string }) {
  return (
    <div className="flex shrink-0 items-center rounded-chip bg-sand/30 p-0.5 text-[10px]">
      {FORECAST_PERIODS.map((p) => (
        <Link
          key={p}
          href={href(p)}
          scroll={false}
          aria-current={current === p ? 'true' : undefined}
          className={`rounded px-1.5 py-0.5 font-medium transition ${
            current === p ? 'bg-soot text-snow' : 'text-taupe hover:text-soot'
          }`}
        >
          {SHORT[p]}
        </Link>
      ))}
    </div>
  );
}
