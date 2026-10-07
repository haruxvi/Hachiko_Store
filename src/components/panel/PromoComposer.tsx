'use client';

import { useMemo, useState, useTransition } from 'react';
import { sendPromoTestAction, sendPromoCampaignAction, type PromoActionResult } from '@/src/actions/newsletter';
import { PromoInputSchema, MAX_PROMO_PRODUCTS } from '@/src/lib/newsletter/validation';
import { promoEmail, absoluteUrl } from '@/src/lib/newsletter/templates';
import { formatCLP } from '@/src/lib/format';

const people = (n: number) => `${n.toLocaleString('es-CL')} ${n === 1 ? 'persona' : 'personas'}`;

interface ProductOption {
  id: string;
  name: string;
  priceCLP: number;
  slug: string;
  image: string | null;
}

export default function PromoComposer({
  products,
  categories,
  audienceCount,
  appUrl,
  canSend,
}: {
  products: ProductOption[];
  categories: { name: string; slug: string }[];
  audienceCount: number;
  appUrl: string;
  canSend: boolean;
}) {
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Ver catálogo');
  const [ctaPath, setCtaPath] = useState('/catalogo');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<PromoActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const payload = {
    subject,
    title,
    body,
    ctaLabel: ctaPath ? ctaLabel : undefined,
    ctaPath: ctaPath || undefined,
    productIds,
  };
  // Misma validación que el servidor: el botón no se habilita con datos que el
  // servidor rechazaría (y el servidor valida igual, por si acaso).
  const parsed = PromoInputSchema.safeParse(payload);
  const firstError = parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Revisa los campos.');

  const previewHtml = useMemo(() => {
    const selected = productIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is ProductOption => !!p);
    return promoEmail({
      title: title || 'Título de la promoción',
      body: body || 'Aquí va el mensaje de la promoción.',
      cta: ctaPath && ctaLabel ? { label: ctaLabel, url: absoluteUrl(appUrl, ctaPath) } : null,
      products: selected.map((p) => ({
        name: p.name,
        priceCLP: p.priceCLP,
        url: absoluteUrl(appUrl, `/producto/${p.slug}`),
        image: p.image,
      })),
      unsubscribeUrl: '#',
    });
  }, [title, body, ctaLabel, ctaPath, productIds, products, appUrl]);

  const visibleProducts = products.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  function toggleProduct(id: string) {
    setProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < MAX_PROMO_PRODUCTS ? [...prev, id] : prev,
    );
  }

  function run(action: (input: unknown) => Promise<PromoActionResult>) {
    setTouched(true);
    if (!parsed.success) return;
    setResult(null);
    startTransition(async () => {
      const res = await action(parsed.data);
      setResult(res);
      setConfirming(false);
    });
  }

  const label = 'mb-1.5 block text-xs font-medium text-taupe';

  return (
    <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="card-hs shadow-soft space-y-5 p-6">
        <div>
          <label className={label} htmlFor="promo-subject">Asunto del correo</label>
          <input id="promo-subject" className="input-hs" maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ej: 20% en snacks este fin de semana" />
        </div>
        <div>
          <label className={label} htmlFor="promo-title">Título</label>
          <input id="promo-title" className="input-hs" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Llegaron los Pepero de temporada" />
        </div>
        <div>
          <label className={label} htmlFor="promo-body">Mensaje</label>
          <textarea id="promo-body" className="input-hs" rows={7} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe el detalle de la promoción. Deja una línea en blanco para separar párrafos." />
          <p className="mt-1 text-right text-xs text-taupe">{body.length}/2000</p>
        </div>

        <div>
          <span className={label}>
            Productos destacados ({productIds.length}/{MAX_PROMO_PRODUCTS})
          </span>
          <input className="input-hs mb-2" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto…" aria-label="Buscar producto" />
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-input border border-sand bg-snow p-2">
            {visibleProducts.map((p) => {
              const checked = productIds.includes(p.id);
              const disabled = !checked && productIds.length >= MAX_PROMO_PRODUCTS;
              return (
                <li key={p.id}>
                  <label className={`flex items-center gap-2.5 rounded-chip px-2 py-1.5 text-sm ${disabled ? 'opacity-50' : 'cursor-pointer hover:bg-cream'}`}>
                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleProduct(p.id)} className="h-4 w-4 accent-rust" />
                    <span className="flex-1 text-soot">{p.name}</span>
                    <span className="price-mono text-xs text-taupe">{formatCLP(p.priceCLP)}</span>
                  </label>
                </li>
              );
            })}
            {visibleProducts.length === 0 && <li className="px-2 py-1.5 text-sm text-taupe">Sin resultados.</li>}
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="promo-cta-path">Botón lleva a</label>
            <select id="promo-cta-path" className="input-hs" value={ctaPath} onChange={(e) => setCtaPath(e.target.value)}>
              <option value="">Sin botón</option>
              <option value="/catalogo">Catálogo completo</option>
              {categories.map((c) => (
                <option key={c.slug} value={`/catalogo?categoria=${c.slug}`}>
                  Categoría: {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="promo-cta-label">Texto del botón</label>
            <input id="promo-cta-label" className="input-hs" maxLength={40} value={ctaLabel} disabled={!ctaPath} onChange={(e) => setCtaLabel(e.target.value)} />
          </div>
        </div>

        {touched && firstError && (
          <p role="alert" className="rounded-input border border-rust/30 bg-rust/[0.08] px-4 py-2.5 text-sm text-[#b06a2c]">
            {firstError}
          </p>
        )}
        {result && (
          <p
            role="status"
            className={`rounded-input border px-4 py-2.5 text-sm ${result.ok ? 'border-mint-deep/30 bg-mint/40 text-[#4e7a5e]' : 'border-rust/30 bg-rust/[0.08] text-[#b06a2c]'}`}
          >
            {result.message}
          </p>
        )}

        {confirming ? (
          <div className="rounded-input border border-rust/40 bg-cream p-4">
            <p className="text-sm text-soot">
              Se enviará a <strong>{people(audienceCount)}</strong>. No se puede deshacer.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary btn-sm" disabled={pending} onClick={() => run(sendPromoCampaignAction)}>
                {pending ? 'Enviando…' : 'Sí, enviar ahora'}
              </button>
              <button type="button" className="btn-outline btn-sm" disabled={pending} onClick={() => setConfirming(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-outline btn-sm" disabled={pending || !canSend} onClick={() => run(sendPromoTestAction)}>
              {pending ? 'Enviando…' : 'Enviarme una prueba'}
            </button>
            <button
              type="button"
              className="btn-primary btn-sm disabled:opacity-50"
              disabled={pending || !canSend || audienceCount === 0}
              onClick={() => {
                setTouched(true);
                if (parsed.success) setConfirming(true);
              }}
            >
              Enviar a {people(audienceCount)}
            </button>
          </div>
        )}
        {audienceCount === 0 && (
          <p className="text-xs text-taupe">Aún no hay personas suscritas que puedan recibir promociones.</p>
        )}
      </div>

      <div className="card-hs shadow-soft overflow-hidden">
        <div className="border-b border-sand px-5 py-3 text-xs font-medium text-taupe">
          Vista previa — así lo recibirán{subject ? `: “${subject}”` : ''}
        </div>
        {/* sandbox vacío: el correo se dibuja aislado, sin scripts ni acceso a la página. */}
        <iframe title="Vista previa del correo" sandbox="" srcDoc={previewHtml} className="h-[640px] w-full bg-cream" />
      </div>
    </section>
  );
}
