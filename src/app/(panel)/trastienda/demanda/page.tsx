import Link from 'next/link';
import { getDemandForecast, getProductTrends, getExpectedProfit } from '@/src/lib/services/intelligence.service';
import { getElasticityOverview, MIN_WINDOW_DAYS, READING_LABEL, type ElasticityOverview } from '@/src/lib/services/elasticity.service';
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

// `periodo` controla toda la página. Los parámetros antiguos (uno por sección) se
// aceptan como respaldo para que los links guardados sigan funcionando.
type Params = { periodo?: string; tablePeriod?: string; unitsPeriod?: string; profitPeriod?: string };

const LABEL: Record<ForecastPeriod, string> = { day: 'Día', week: 'Semana', month: 'Mes' };
const PER: Record<ForecastPeriod, string> = { day: 'por día', week: 'por semana', month: 'del mes' };

export default async function DemandaPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const period = parsePeriod(params.periodo ?? params.tablePeriod ?? params.unitsPeriod ?? params.profitPeriod);

  // Una sola lectura del pronóstico: toda la página deriva del mismo dato mensual.
  const [forecast, trends, profit, elasticity] = await Promise.all([
    getDemandForecast(),
    getProductTrends(),
    getExpectedProfit(),
    getElasticityOverview(),
  ]);

  // La elasticidad no depende del modelo: se muestra aunque el pronóstico aún no exista.
  if (!forecast.hasData) {
    return (
      <div className="space-y-8">
        <IntelligencePlaceholder
          icon="arrow"
          title="Demanda"
          description="Pronóstico de demanda por producto con estacionalidad, para anticipar las compras."
          phase="Fase 2 · Núcleo predictivo"
          count={0}
          countLabel="pronósticos"
        />
        <ElasticitySection data={elasticity} />
      </div>
    );
  }

  // El mes que realmente pronosticó el modelo (no "hoy + 1 mes": si el modelo
  // corrió antes, ambos difieren y la etiqueta mentiría).
  const firstPoint = forecast.products[0]?.points[0];
  const forecastMonth = firstPoint ? monthLabel(firstPoint.periodStart) : '';

  const totalUnits = forecast.products.reduce((sum, p) => {
    const pt = p.points[0];
    return pt ? sum + scaleToPeriod(pt.predicted, period, pt.horizonDays) : sum;
  }, 0);

  return (
    <div className="space-y-8">
      <PageHeader title="Demanda" subtitle="Lo que viene, para comprar a tiempo" updated={forecast.lastUpdated} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>Resumen del pronóstico · {forecastMonth}</Eyebrow>
          <PeriodToggle current={period} />
        </div>
        {period !== 'month' && (
          <p className="text-[12px] text-taupe">
            Vista {PER[period]}: promedio derivado del pronóstico mensual del modelo, suponiendo demanda pareja
            durante el mes.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label={`Ganancia esperada ${PER[period]}`}
            value={clp(scaleToPeriod(profit.expectedProfit, period, profit.horizonDays))}
            accent
            hint={`margen ${pct(profit.marginPct)} · ingresos ${clp(scaleToPeriod(profit.expectedRevenue, period, profit.horizonDays))}${
              profit.withoutCost > 0 ? ` · ${profit.withoutCost} sin costo, fuera de la ganancia` : ''
            }`}
          />
          <Stat label={`Unidades previstas ${PER[period]}`} value={formatUnits(totalUnits, period)} />
          <Stat label="Productos pronosticados" value={num(forecast.products.length)} />
          <Stat
            label="Error medio del modelo"
            value={forecast.mae != null ? `${forecast.mae} uds/mes` : '—'}
            hint={
              forecast.mae != null && forecast.maeNaive != null
                ? `En los últimos 3 meses, sin haberlos visto. Repetir el año anterior se equivoca en ${forecast.maeNaive}.`
                : 'Ridge con estacionalidad'
            }
          />
        </div>
      </section>

      <section className="card-hs shadow-soft p-6">
        <Eyebrow>Pronóstico por producto</Eyebrow>
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
                  {forecastMonth} · {PER[period]}
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
                const show = (q: number) => formatUnits(pt ? scaleToPeriod(q, period, pt.horizonDays) : 0, period);
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
                        <span className="chip-hs border-transparent bg-rust/[0.12] text-[11px] text-rust-ink">riesgo de quiebre</span>
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
            <p className="mt-1 text-[12px] text-taupe">
              {trends.comparison === 'year'
                ? 'Últimos 90 días vs. los mismos 90 días del año pasado (así la temporada no engaña).'
                : 'Últimos 90 días vs. los 90 anteriores.'}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {trends.rising.map((t) => (
                <li key={t.name} className="flex justify-between border-b border-sand/40 pb-1.5 last:border-0">
                  <span className="text-soot">{t.name}</span>
                  <span className="price-mono font-medium text-mint-ink">▲ {pct(t.growth)}</span>
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

      <ElasticitySection data={elasticity} />
    </div>
  );
}

/** Cómo reaccionaron las ventas a los cambios de precio reales (PriceHistory). */
function ElasticitySection({ data }: { data: ElasticityOverview }) {
  const signed = (f: number) => `${f > 0 ? '+' : ''}${(f * 100).toFixed(0)} %`;
  return (
    <section className="card-hs shadow-soft p-6">
      <Eyebrow>Elasticidad-precio</Eyebrow>
      <p className="mt-1 text-[12px] text-taupe">
        Cómo cambiaron las ventas por día después de cada cambio de precio real (hasta 28 días antes y después, solo ventas
        pagadas). Es descriptivo: también influyen la temporada, las promociones y el stock.
      </p>

      {data.changes === 0 ? (
        <p className="mt-4 text-sm text-taupe">
          Todavía no hay cambios de precio. Cuando edites un precio en Productos, aquí verás cómo reaccionaron las ventas
          después de {MIN_WINDOW_DAYS} días.
        </p>
      ) : (
        <>
          {data.measured.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand text-left text-taupe">
                    <th className="py-2 pr-3 text-[12px] font-medium">Producto</th>
                    <th className="py-2 pr-3 text-right text-[12px] font-medium">Precio</th>
                    <th className="py-2 pr-3 text-right text-[12px] font-medium">Ventas/día</th>
                    <th className="py-2 pr-3 text-right text-[12px] font-medium">Elasticidad</th>
                    <th className="py-2 text-[12px] font-medium">Lectura</th>
                  </tr>
                </thead>
                <tbody>
                  {data.measured.map(({ productId, name, sku, effect: e }) => (
                    <tr key={productId} className="border-b border-sand/40 last:border-0 hover:bg-sand/10">
                      <td className="py-2.5 pr-3">
                        <Link href={`/trastienda/productos/${productId}`} className="font-medium text-soot hover:text-rust-ink">
                          {name}
                        </Link>
                        <span className="block text-[11px] text-taupe">{sku}</span>
                      </td>
                      <td className="price-mono whitespace-nowrap py-2.5 pr-3 text-right text-soot">
                        {clp(e.previousCLP)} → {clp(e.newCLP)} <span className="text-taupe">({signed(e.priceChange)})</span>
                      </td>
                      <td className="price-mono py-2.5 pr-3 text-right text-soot">{signed(e.unitsChange)}</td>
                      <td className="price-mono py-2.5 pr-3 text-right font-medium text-soot">
                        {e.elasticity.toLocaleString('es-CL', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 text-[12px] text-taupe">{READING_LABEL[e.reading]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-[12px] text-taupe">
            {num(data.changes)} {data.changes === 1 ? 'cambio de precio registrado' : 'cambios de precio registrados'}
            {data.measured.length > 0 && ` · ${num(data.measured.length)} con medición`}
            {data.pending > 0 && ` · ${num(data.pending)} en espera de ${MIN_WINDOW_DAYS} días de ventas`}
            {data.insufficient > 0 && ` · ${num(data.insufficient)} sin datos suficientes`}.
          </p>
        </>
      )}
    </section>
  );
}

function PeriodToggle({ current }: { current: ForecastPeriod }) {
  return (
    <nav aria-label="Período del pronóstico" className="inline-flex rounded-chip border border-sand bg-cream p-0.5">
      {FORECAST_PERIODS.map((p) => (
        <Link
          key={p}
          href={p === 'month' ? '/trastienda/demanda' : `/trastienda/demanda?periodo=${p}`}
          scroll={false}
          aria-current={current === p ? 'true' : undefined}
          className={`rounded-[6px] px-3 py-1 text-[13px] font-medium transition ${
            current === p ? 'bg-soot text-snow' : 'text-taupe hover:text-soot'
          }`}
        >
          {LABEL[p]}
        </Link>
      ))}
    </nav>
  );
}
