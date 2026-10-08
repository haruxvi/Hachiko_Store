import type { Metadata } from 'next';
import { db } from '@/src/lib/db';
import { getAvailableStockBatch } from '@/src/lib/services/inventory.service';
import AppCartImport from '@/src/components/storefront/AppCartImport';

export const metadata: Metadata = { title: 'Llevando tu carrito — Hachiko', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Puente app → pago web. La app abre esta página en el navegador seguro del
// teléfono con ?i=slug:cantidad,slug:cantidad. Aquí el SERVIDOR pone el precio
// y revisa el stock (la app nunca decide precios), se arma el carrito de la web
// y se sigue al checkout que ya funciona (Webpay / Mercado Pago).
const MAX_LINES = 30;

function parseItems(raw: string | undefined): { slug: string; qty: number }[] {
  if (!raw || raw.length > 2000) return [];
  const out = new Map<string, number>();
  for (const part of raw.split(',').slice(0, MAX_LINES)) {
    const [slug, q] = part.split(':');
    const qty = Math.floor(Number(q));
    if (slug && /^[a-z0-9-]{1,120}$/.test(slug) && qty >= 1 && qty <= 99) out.set(slug, Math.min(99, (out.get(slug) ?? 0) + qty));
  }
  return [...out].map(([slug, qty]) => ({ slug, qty }));
}

export default async function DesdeAppPage({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  const requested = parseItems((await searchParams).i);
  const products = requested.length
    ? await db.product.findMany({
        where: { slug: { in: requested.map((r) => r.slug) }, active: true, archivedAt: null },
        select: { id: true, slug: true, name: true, priceCLP: true, images: true },
      })
    : [];
  const available = await getAvailableStockBatch(products.map((p) => p.id));

  const items: { id: string; name: string; priceCLP: number; image: string | null; quantity: number }[] = [];
  const adjusted: string[] = [];
  for (const r of requested) {
    const p = products.find((x) => x.slug === r.slug);
    if (!p) continue;
    const qty = Math.min(r.qty, Math.max(0, available.get(p.id) ?? 0));
    if (qty < r.qty) adjusted.push(qty === 0 ? `${p.name} se agotó` : `${p.name}: quedan ${qty}`);
    if (qty > 0) items.push({ id: p.id, name: p.name, priceCLP: p.priceCLP, image: p.images[0] ?? null, quantity: qty });
  }
  const missing = requested.length - products.length;
  if (missing > 0) adjusted.push(missing === 1 ? 'Un producto ya no está a la venta' : `${missing} productos ya no están a la venta`);

  return (
    <div className="mx-auto max-w-[480px] px-5 py-16 text-center">
      <AppCartImport items={items} adjusted={adjusted} />
    </div>
  );
}
