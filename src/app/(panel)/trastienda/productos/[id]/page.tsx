import { notFound } from 'next/navigation';
import { getSession } from '@/src/lib/auth/session';
import { getProductById, getCategories, getPriceHistory } from '@/src/lib/services/catalog.service';
import { getProductElasticity, MIN_WINDOW_DAYS, READING_LABEL, WINDOW_DAYS, type ChangeEffect } from '@/src/lib/services/elasticity.service';
import ProductForm from '@/src/components/panel/ProductForm';

const clp = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
const signedPct = (f: number) => `${f > 0 ? '+' : ''}${(f * 100).toFixed(0)} %`;
const perDay = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 1 });

/** Qué pasó con las ventas tras un cambio de precio (o por qué aún no se sabe). */
function EffectLine({ effect }: { effect?: ChangeEffect }) {
  if (!effect) return null;
  if (effect.status === 'pending')
    return <p className="mt-1 text-xs text-taupe">Efecto en ventas: se mide en {effect.daysLeft} {effect.daysLeft === 1 ? 'día' : 'días'}.</p>;
  if (effect.status === 'insufficient') return <p className="mt-1 text-xs text-taupe">Efecto en ventas: {effect.reason}</p>;
  return (
    <p className="mt-1 text-xs text-taupe">
      Ventas: <span className="price-mono text-soot">{perDay(effect.unitsPerDayBefore)}</span> →{' '}
      <span className="price-mono text-soot">{perDay(effect.unitsPerDayAfter)}</span> u/día ({signedPct(effect.unitsChange)}) ·{' '}
      elasticidad <span className="price-mono text-soot">{effect.elasticity.toLocaleString('es-CL', { maximumFractionDigits: 2 })}</span> ·{' '}
      {READING_LABEL[effect.reading]}
    </p>
  );
}

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const { id } = await params;
  const [product, categories, priceHistory, effects] = await Promise.all([
    getProductById(id),
    getCategories(false),
    getPriceHistory(id),
    getProductElasticity(id),
  ]);

  if (!product) notFound();
  const effectById = new Map(effects.map((e) => [e.id, e]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-6 text-xl font-bold">Editar: {product.name}</h1>
        <ProductForm categories={categories} initial={product} />
      </div>

      <section className="card-hs shadow-soft p-6">
        <h2 className="editorial text-[15px] text-taupe">Historial de precios</h2>
        {priceHistory.length === 0 ? (
          <p className="mt-3 text-sm text-taupe">Sin cambios de precio registrados todavía.</p>
        ) : (
          <>
            <ul className="mt-4 space-y-2 text-sm">
              {priceHistory.map((h) => {
                const up = h.newCLP > h.previousCLP;
                return (
                  <li key={h.id} className="border-b border-sand/60 pb-2 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-taupe">{new Date(h.createdAt).toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'medium', timeStyle: 'short' })}</span>
                      <span className="text-soot">
                        <span className="price-mono text-taupe">{clp(h.previousCLP)}</span>
                        <span className="mx-2 text-taupe">→</span>
                        <span className={`price-mono ${up ? 'text-alert' : 'text-mint-ink'}`}>{clp(h.newCLP)} {up ? '▲' : '▼'}</span>
                      </span>
                    </div>
                    <EffectLine effect={effectById.get(h.id)} />
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs text-taupe">
              El efecto compara las unidades vendidas por día hasta {WINDOW_DAYS} días antes y después de cada cambio (mínimo{' '}
              {MIN_WINDOW_DAYS} días y solo ventas pagadas). Es descriptivo: también influyen la temporada, las promociones y el stock.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
