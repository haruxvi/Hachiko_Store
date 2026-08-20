import { getRecommendations } from '@/src/lib/services/intelligence.service';
import IntelligencePlaceholder from '@/src/components/panel/IntelligencePlaceholder';
import { PageHeader, Eyebrow } from '@/src/components/panel/intelligence-ui';

export const revalidate = 60;

export default async function RecomendacionesPage() {
  const d = await getRecommendations();

  if (!d.hasData) {
    return (
      <IntelligencePlaceholder
        icon="heart"
        title="Recomendaciones"
        description="Productos que se compran juntos, para armar packs y sugerencias que suban el ticket promedio."
        phase="Fase 2 · Núcleo predictivo"
        count={0}
        countLabel="recomendaciones"
      />
    );
  }

  return (
    <div className="space-y-9">
      <PageHeader title="Recomendaciones" subtitle="Qué se compra junto con qué" updated={d.lastUpdated} />

      <section className="space-y-4">
        <Eyebrow>Se compran juntos</Eyebrow>
        <p className="text-[13px] text-taupe">
          Reglas de asociación por <span className="text-soot">lift</span> — cuánto más probable es comprar el segundo producto cuando ya está el primero en el carrito.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {d.groups.map((g) => (
            <div key={g.productId} className="card-hs shadow-soft p-5">
              <p className="text-[13px] text-taupe">Quienes compran</p>
              <p className="mt-0.5 font-display text-lg font-bold text-soot">{g.name}</p>
              <p className="mt-3 text-[13px] text-taupe">también llevan</p>
              <ul className="mt-2 space-y-2">
                {g.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-chip bg-cream px-3 py-2">
                    <span className="text-sm text-soot">{it.name}</span>
                    <span className="price-mono text-xs text-rust-dark">×{it.score.toFixed(1)} lift</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
