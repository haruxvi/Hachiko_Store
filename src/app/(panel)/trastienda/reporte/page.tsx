import {
  getMetricsDashboard,
  getRestockSuggestions,
  getFraudRisk,
  getAccountRisk,
  getIncidentAnalytics,
  getConversionAnalytics,
} from '@/src/lib/services/intelligence.service';
import { Eyebrow, Stat, clp, num, pct } from '@/src/components/panel/intelligence-ui';
import PrintButton from '@/src/components/panel/PrintButton';

export const revalidate = 60;

export default async function ReportePage() {
  const [m, restock, fraud, acc, inc, conv] = await Promise.all([
    getMetricsDashboard(),
    getRestockSuggestions(),
    getFraudRisk(),
    getAccountRisk(),
    getIncidentAnalytics(),
    getConversionAnalytics(),
  ]);
  const today = new Date().toLocaleDateString('es-CL', { dateStyle: 'long' });
  const topA = m.products.filter((p) => p.abc === 'A').slice(0, 5);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Reporte de inteligencia</h1>
          <p className="editorial mt-1 text-[15px] text-taupe">Resumen ejecutivo · {today}</p>
        </div>
        <PrintButton />
      </header>

      <section className="space-y-3">
        <Eyebrow>Negocio · últimos 12 meses</Eyebrow>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Ingresos" value={clp(m.totals.revenue)} />
          <Stat label="Margen" value={clp(m.totals.margin)} hint={pct(m.totals.marginPct)} accent />
          <Stat label="Órdenes" value={num(m.totals.orders)} />
          <Stat label="Conversión" value={pct(conv.overallConversion)} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card-hs shadow-soft p-6">
          <Eyebrow>Productos estrella (clase A)</Eyebrow>
          <ul className="mt-4 space-y-2 text-sm">
            {topA.map((p) => (
              <li key={p.productId} className="flex justify-between border-b border-sand/60 pb-1.5 last:border-0">
                <span className="text-soot">{p.name}</span>
                <span className="price-mono text-taupe">{clp(p.revenue)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card-hs shadow-soft p-6">
          <Eyebrow>Acciones sugeridas</Eyebrow>
          <ul className="mt-4 space-y-2.5 text-sm text-soot">
            <li className="flex justify-between"><span>Reposición urgente</span><span className="price-mono text-rust-dark">{num(restock.urgent)} productos</span></li>
            <li className="flex justify-between"><span>Carritos recuperables</span><span className="price-mono">{num(conv.recoverable)}</span></li>
            <li className="flex justify-between"><span>Órdenes a revisar (fraude)</span><span className="price-mono">{num(fraud.flagged)}</span></li>
            <li className="flex justify-between"><span>Cuentas bajo ataque</span><span className="price-mono text-alert">{num(acc.flagged)}</span></li>
          </ul>
        </section>
      </div>

      <section className="card-hs shadow-soft p-6">
        <Eyebrow>Seguridad</Eyebrow>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Incidentes abiertos" value={num(inc.open)} />
          <Stat label="MTTR" value={inc.mttrHours != null ? `${inc.mttrHours.toFixed(0)} h` : '—'} />
          <Stat label="Afectan datos pers." value={num(inc.affectsPersonalData)} />
          <Stat label="Cuentas en riesgo" value={num(acc.flagged)} accent />
        </div>
      </section>

      <p className="text-xs text-taupe">
        Generado automáticamente desde el plano analítico. Datos de demostración (sintéticos).
      </p>
    </div>
  );
}
