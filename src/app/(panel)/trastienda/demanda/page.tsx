import Link from 'next/link';
import { getDemandForecast, getProductTrends, getExpectedProfit, PeriodFilter } from '@/src/lib/services/intelligence.service';
import IntelligencePlaceholder from '@/src/components/panel/IntelligencePlaceholder';
import { PageHeader, Eyebrow, Stat, clp, num, pct, monthLabel } from '@/src/components/panel/intelligence-ui';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    profitPeriod?: string;
    unitsPeriod?: string;
    tablePeriod?: string;
  }>;
}

function getDynamicNextMonthLabel(): string {
  const now = new Date();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return monthLabel(nextMonthDate);
}

export default async function DemandaPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;

  const profitPeriod = (['day', 'week', 'month'].includes(resolvedParams.profitPeriod ?? '')
    ? resolvedParams.profitPeriod
    : 'month') as PeriodFilter;

  const unitsPeriod = (['day', 'week', 'month'].includes(resolvedParams.unitsPeriod ?? '')
    ? resolvedParams.unitsPeriod
    : 'month') as PeriodFilter;

  const tablePeriod = (['day', 'week', 'month'].includes(resolvedParams.tablePeriod ?? '')
    ? resolvedParams.tablePeriod
    : 'month') as PeriodFilter;

  const [unitsData, tableData, trends, profit] = await Promise.all([
    getDemandForecast(unitsPeriod),
    getDemandForecast(tablePeriod),
    getProductTrends(),
    getExpectedProfit(profitPeriod),
  ]);

  if (!tableData.hasData) {
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

  const nextLabel = getDynamicNextMonthLabel();

  const periodLabels: Record<PeriodFilter, string> = {
    day: 'Día',
    week: 'Sem.',
    month: 'Mes',
  };

  const profitStatTitle: Record<PeriodFilter, string> = {
    day: 'Ganancia diaria esperada',
    week: 'Ganancia semanal esperada',
    month: 'Ganancia mensual esperada',
  };

  const unitsStatTitle: Record<PeriodFilter, string> = {
    day: `Unidades diarias prev. · ${nextLabel}`,
    week: `Unidades sem. prev. · ${nextLabel}`,
    month: `Unidades prev. · ${nextLabel}`,
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Demanda" subtitle="Lo que viene, para comprar a tiempo" updated={tableData.lastUpdated} />

      {/* Resumen de Métricas */}
      <section className="space-y-3">
        <Eyebrow>Resumen del pronóstico</Eyebrow>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          
          {/* Stat 1: Ganancia esperada */}
          <div className="card-hs relative flex flex-col justify-between p-4 shadow-soft">
            <div className="flex items-center justify-between gap-1 border-b border-sand/40 pb-2">
              <span className="text-[12px] font-medium text-taupe truncate">{profitStatTitle[profitPeriod]}</span>
              
              {/* Selector compacto */}
              <div className="flex items-center rounded-md bg-sand/30 p-0.5 text-[10px]">
                {(['day', 'week', 'month'] as PeriodFilter[]).map((p) => (
                  <Link
                    key={p}
                    href={`/trastienda/demanda?profitPeriod=${p}&unitsPeriod=${unitsPeriod}&tablePeriod=${tablePeriod}`}
                    className={`rounded px-1.5 py-0.5 font-medium transition-all ${
                      profitPeriod === p
                        ? 'bg-soot text-white shadow-2xs'
                        : 'text-taupe hover:text-soot'
                    }`}
                  >
                    {periodLabels[p]}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <div className="price-mono text-2xl font-semibold tracking-tight text-mint-deep">
                {clp(profit.expectedProfit)}
              </div>
              <p className="mt-1 text-[11px] text-taupe">
                margen {pct(profit.marginPct)} · ingresos {clp(profit.expectedRevenue)}
              </p>
            </div>
          </div>

          {/* Stat 2: Unidades previstas */}
          <div className="card-hs relative flex flex-col justify-between p-4 shadow-soft">
            <div className="flex items-center justify-between gap-1 border-b border-sand/40 pb-2">
              <span className="text-[12px] font-medium text-taupe truncate">{unitsStatTitle[unitsPeriod]}</span>
              
              {/* Selector compacto */}
              <div className="flex items-center rounded-md bg-sand/30 p-0.5 text-[10px]">
                {(['day', 'week', 'month'] as PeriodFilter[]).map((p) => (
                  <Link
                    key={p}
                    href={`/trastienda/demanda?profitPeriod=${profitPeriod}&unitsPeriod=${p}&tablePeriod=${tablePeriod}`}
                    className={`rounded px-1.5 py-0.5 font-medium transition-all ${
                      unitsPeriod === p
                        ? 'bg-soot text-white shadow-2xs'
                        : 'text-taupe hover:text-soot'
                    }`}
                  >
                    {periodLabels[p]}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <div className="price-mono text-2xl font-semibold tracking-tight text-soot">
                {num(unitsData.totalNextMonth)}
              </div>
            </div>
          </div>

          {/* Stat 3: Productos pronosticados */}
          <Stat 
            label="Productos pronosticados" 
            value={num(tableData.products.length)} 
          />

          {/* Stat 4: Error medio */}
          <Stat 
            label="Error medio del modelo" 
            value={tableData.mae != null ? `${tableData.mae} uds/mes` : '—'} 
            hint="Ridge con estacionalidad" 
          />
        </div>
      </section>

      {/* Tabla por producto */}
      <section className="card-hs shadow-soft p-6">
        <div className="flex items-center justify-between">
          <Eyebrow>Pronóstico por producto ({periodLabels[tablePeriod].toLowerCase()})</Eyebrow>
          
          {/* Selector compacto para la tabla */}
          <div className="flex items-center rounded-md bg-sand/30 p-0.5 text-[10px]">
            {(['day', 'week', 'month'] as PeriodFilter[]).map((p) => (
              <Link
                key={p}
                href={`/trastienda/demanda?profitPeriod=${profitPeriod}&unitsPeriod=${unitsPeriod}&tablePeriod=${p}`}
                className={`rounded px-2 py-0.5 font-medium transition-all ${
                  tablePeriod === p
                    ? 'bg-soot text-white shadow-2xs'
                    : 'text-taupe hover:text-soot'
                }`}
              >
                {periodLabels[p]}
              </Link>
            ))}
          </div>
        </div>

        <p className="mt-1 text-[12px] text-taupe">
          Ordenado por demanda estimada. Cuando el pronóstico supera el stock actual, se marca el riesgo de quiebre.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-taupe">
                <th className="py-2 pr-3 text-[12px] font-medium">Producto</th>
                <th className="py-2 pr-3 text-right text-[12px] font-medium">{nextLabel}</th>
                <th className="py-2 pr-3 text-right text-[12px] font-medium">Rango</th>
                <th className="py-2 pr-3 text-right text-[12px] font-medium">Stock</th>
                <th className="py-2 text-right text-[12px] font-medium">Señal</th>
              </tr>
            </thead>
            <tbody>
              {tableData.products.map((p) => {
                const pt = p.points[0];
                const risk = pt ? pt.predicted > p.stock : false;
                return (
                  <tr key={p.productId} className="border-b border-sand/40 last:border-0 hover:bg-sand/10">
                    <td className="py-2.5 pr-3 text-soot font-medium">{p.name}</td>
                    <td className="price-mono py-2.5 pr-3 text-right text-soot">{num(pt?.predicted ?? 0)}</td>
                    <td className="price-mono py-2.5 pr-3 text-right text-taupe">{num(pt?.lower ?? 0)}–{num(pt?.upper ?? 0)}</td>
                    <td className="price-mono py-2.5 pr-3 text-right text-taupe">{num(p.stock)}</td>
                    <td className="py-2.5 text-right">
                      {risk
                        ? <span className="chip-hs border-transparent bg-rust/[0.12] text-[#b06a2c] text-[11px]">riesgo de quiebre</span>
                        : <span className="chip-mint text-[11px]">ok</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tendencias */}
      {trends.hasData && (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="card-hs shadow-soft p-6">
            <Eyebrow>Productos en alza</Eyebrow>
            <p className="mt-1 text-[12px] text-taupe">Últimos 90 días vs. los 90 anteriores.</p>
            <ul className="mt-4 space-y-2 text-sm">
              {trends.rising.map((t) => (
                <li key={t.name} className="flex justify-between border-b border-sand/40 pb-1.5 last:border-0">
                  <span className="text-soot">{t.name}</span>
                  <span className="price-mono text-mint-deep font-medium">▲ {pct(t.growth)}</span>
                </li>
              ))}
              {trends.rising.length === 0 && <li className="text-taupe text-xs">Sin productos en alza clara.</li>}
            </ul>
          </div>
          <div className="card-hs shadow-soft p-6">
            <Eyebrow>Productos en baja</Eyebrow>
            <p className="mt-1 text-[12px] text-taupe">Caída de demanda — revisar precio o promoción.</p>
            <ul className="mt-4 space-y-2 text-sm">
              {trends.declining.map((t) => (
                <li key={t.name} className="flex justify-between border-b border-sand/40 pb-1.5 last:border-0">
                  <span className="text-soot">{t.name}</span>
                  <span className="price-mono text-alert font-medium">▼ {pct(Math.abs(t.growth))}</span>
                </li>
              ))}
              {trends.declining.length === 0 && <li className="text-taupe text-xs">Sin productos en baja clara.</li>}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}