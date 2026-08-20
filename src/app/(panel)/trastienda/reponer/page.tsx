import { getRestockSuggestions, getShrinkage, getDeadStock } from '@/src/lib/services/intelligence.service';
import IntelligencePlaceholder from '@/src/components/panel/IntelligencePlaceholder';
import { PageHeader, Eyebrow, Stat, clp, num } from '@/src/components/panel/intelligence-ui';

export const revalidate = 60;

export default async function ReponerPage() {
  const [d, shrink, dead] = await Promise.all([getRestockSuggestions(), getShrinkage(), getDeadStock()]);

  if (!d.hasData) {
    return (
      <IntelligencePlaceholder
        icon="truck"
        title="Qué reponer"
        description="Qué productos comprar y en qué cantidad, según demanda pronosticada y días hasta el quiebre de stock."
        phase="Fase 2 · Núcleo predictivo"
        count={0}
        countLabel="sugerencias"
      />
    );
  }

  return (
    <div className="space-y-9">
      <PageHeader title="Qué reponer" subtitle="Compras sugeridas antes de quedarte sin stock" updated={d.lastUpdated} />

      <section className="space-y-3">
        <Eyebrow>Resumen</Eyebrow>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat label="Productos a reponer" value={num(d.suggestions.length)} />
          <Stat label="Urgentes" value={num(d.urgent)} accent hint="quiebre dentro del lead time" />
          <Stat label="Unidades a comprar" value={num(d.suggestions.reduce((a, s) => a + s.suggestedQty, 0))} />
        </div>
      </section>

      <section className="card-hs shadow-soft p-6">
        <Eyebrow>Sugerencias de compra</Eyebrow>
        <p className="mt-1.5 text-[13px] text-taupe">Ordenadas por urgencia. El lead time asumido es de 14 días con 30 días de cobertura.</p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-taupe">
                <th className="py-2 pr-3 text-[13px] font-semibold">Producto</th>
                <th className="py-2 pr-3 text-right text-[13px] font-semibold">Stock</th>
                <th className="py-2 pr-3 text-right text-[13px] font-semibold">Días a quiebre</th>
                <th className="py-2 pr-3 text-right text-[13px] font-semibold">Comprar</th>
                <th className="py-2 text-left text-[13px] font-semibold">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {d.suggestions.map((s) => (
                <tr key={s.productId} className="border-b border-sand/60 last:border-0">
                  <td className="py-2.5 pr-3">
                    <span className="text-soot">{s.name}</span>
                    {s.score >= 0.5 && <span className="chip-blush ml-2">urgente</span>}
                  </td>
                  <td className="price-mono py-2.5 pr-3 text-right text-taupe">{num(s.stock)}</td>
                  <td className="price-mono py-2.5 pr-3 text-right text-soot">{s.daysToStockout != null ? `${s.daysToStockout} d` : '—'}</td>
                  <td className="price-mono py-2.5 pr-3 text-right font-semibold text-rust-dark">+{num(s.suggestedQty)}</td>
                  <td className="max-w-xs py-2.5 text-xs text-taupe">{s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {dead.hasData && (
          <section className="card-hs shadow-soft p-6">
            <Eyebrow>Sobre-stock (capital inmovilizado)</Eyebrow>
            <p className="mt-1.5 text-[13px] text-taupe">
              Productos con mucho stock y poca venta reciente — <span className="price-mono text-rust-dark">{clp(dead.totalImmobilized)}</span> inmovilizados.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {dead.items.map((it) => (
                <li key={it.name} className="flex justify-between border-b border-sand/60 pb-1.5 last:border-0">
                  <span className="text-soot">{it.name}</span>
                  <span className="text-taupe"><span className="price-mono">{num(it.stock)}</span> en stock · <span className="price-mono">{num(it.sold90)}</span> vendidos 90d</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {shrink.hasData && (
          <section className="card-hs shadow-soft p-6">
            <Eyebrow>Mermas</Eyebrow>
            <p className="mt-1.5 text-[13px] text-taupe">
              Pérdidas por daño/vencimiento — <span className="price-mono text-alert">{clp(shrink.totalCost)}</span> ({num(shrink.totalUnits)} uds).
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {shrink.items.slice(0, 8).map((it, i) => (
                <li key={i} className="flex justify-between border-b border-sand/60 pb-1.5 last:border-0">
                  <span className="text-soot">{it.name} <span className="chip-hs ml-1">{it.reason === 'DAMAGED' ? 'dañado' : 'vencido'}</span></span>
                  <span className="price-mono text-taupe">{num(it.qty)} · {clp(it.cost)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
