'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/src/lib/stores/cart';

type Item = { id: string; name: string; priceCLP: number; image: string | null; quantity: number };

// Reemplaza el carrito de este navegador por el que viene de la app y sigue al
// pago. Si algo cambió (sin stock, ya no se vende), lo avisa antes de seguir.
// Marca la visita como "desde la app" para que la confirmación ofrezca volver.
export default function AppCartImport({ items, adjusted }: { items: Item[]; adjusted: string[] }) {
  const router = useRouter();
  // Si todo calzó, se sigue directo al pago; si algo cambió, se muestra antes.
  const goStraight = items.length > 0 && adjusted.length === 0;

  useEffect(() => {
    const cart = useCartStore.getState();
    cart.clear();
    for (const i of items) cart.addItem(i);
    try {
      sessionStorage.setItem('hachiko-from-app', '1');
    } catch {}
    if (goStraight) router.replace('/checkout');
  }, [items, goStraight, router]);

  if (goStraight) {
    return (
      <div role="status" aria-live="polite">
        <p className="font-display text-2xl font-bold text-soot">Llevando tu carrito…</p>
        <p className="mt-2 text-taupe">Un momento, te llevamos al pago seguro.</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div>
        <p className="font-display text-2xl font-bold text-soot">Tu carrito quedó vacío</p>
        <ul className="mt-3 space-y-1 text-taupe">{adjusted.map((a) => <li key={a}>{a}.</li>)}</ul>
        <a href="hachiko://carrito" className="btn-primary mt-6">Volver a la app</a>
      </div>
    );
  }

  return (
    <div>
      <p className="font-display text-2xl font-bold text-soot">Revisamos tu carrito</p>
      <ul className="mt-3 space-y-1 text-taupe">{adjusted.map((a) => <li key={a}>{a}.</li>)}</ul>
      <Link href="/checkout" className="btn-primary mt-6">Seguir al pago</Link>
    </div>
  );
}
