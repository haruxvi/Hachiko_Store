import { getLogistics } from '@/src/lib/services/intelligence.service';
import IntelligencePlaceholder from '@/src/components/panel/IntelligencePlaceholder';
import { PageHeader, Eyebrow, clp, num, pct } from '@/src/components/panel/intelligence-ui';

export const revalidate = 60;

const COURIER: Record<string, string> = { STARKEN: 'Starken', CORREOS_CHILE: 'Correos de Chile', PICKUP: 'Retiro en tienda' };

export default async function LogisticaPage() {
  const d = await getLogistics();

  if (!d.hasData) {
    return (
      <IntelligencePlaceholder
        icon="truck"
        title="Logística"
        description="Demanda y costo de despacho por región, y tiempos de entrega por courier."
        phase="Análisis de datos"
        count={0}
        countLabel="regiones con ventas"
      />
    );
  }

  const maxRev = Math.max(...d.byRegion.map((r) => r.revenue), 1);
  const maxDays = Math.max(...d.byCourier.map((c) => c.avgDays), 1);

  return (
    <div className="space-y-9">
      <PageHeader title="Logística" subtitle="Dónde vendes y cuánto cuesta llegar" updated={null} />

      <section className="card-hs shadow-soft p-6">
        <Eyebrow>Ventas y costo de despacho por región</Eyebrow>
        <p className="mt-1.5 text-[13px] text-taupe">El % de envío sobre ventas muestra dónde el despacho se come el margen.</p>
        <div className="mt-5 space-y-3">
          {d.byRegion.map((r) => (
            <div key={r.region} className="flex items-center gap-3 text-sm">
              <span className="w-44 shrink-0 truncate text-soot" title={r.region}>{r.region}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-chip bg-sand">
                <div className="h-full rounded-chip bg-rust" style={{ width: `${(r.revenue / maxRev) * 100}%` }} />
              </div>
              <span className="price-mono w-24 shrink-0 text-right text-taupe">{clp(r.revenue)}</span>
              <span className="w-24 shrink-0 text-right text-xs text-rust-dark" title="envío como % de ventas">envío {pct(r.shipPct)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card-hs shadow-soft p-6">
        <Eyebrow>Tiempo de entrega por courier</Eyebrow>
        <p className="mt-1.5 text-[13px] text-taupe">Días promedio desde la compra hasta la entrega. Útil para elegir transportista por zona.</p>
        <div className="mt-5 space-y-3">
          {d.byCourier.map((c) => (
            <div key={c.method} className="flex items-center gap-3 text-sm">
              <span className="w-40 shrink-0 text-soot">{COURIER[c.method] ?? c.method}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-chip bg-sand">
                <div className="h-full rounded-chip bg-tan-mid" style={{ width: `${(c.avgDays / maxDays) * 100}%` }} />
              </div>
              <span className="price-mono w-20 shrink-0 text-right text-soot">{c.avgDays.toFixed(1)} d</span>
              <span className="w-24 shrink-0 text-right text-xs text-taupe">{num(c.delivered)} entregas</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
