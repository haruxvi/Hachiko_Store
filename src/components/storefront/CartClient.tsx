'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCartStore } from '@/src/lib/stores/cart';
import { calculateShipping } from '@/src/lib/shipping';
import { formatCLP } from '@/src/lib/format';
import Icon from '@/src/components/ui/Icon';
import Shiba from '@/src/components/ui/Shiba';

export default function CartClient() {
  const { items, removeItem, updateQuantity, total, itemCount } = useCartStore();
  // El carrito vive en localStorage: se espera al montaje para no desajustar
  // la hidratación con el render del servidor.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const subtotal = total();
  const shipping = calculateShipping(subtotal);
  const grandTotal = subtotal + shipping;

  if (!mounted) return <div className="min-h-[50vh]" />;

  // ── Carrito vacío — el Shiba duerme ──
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center px-6 py-20">
        <div className="max-w-[480px] text-center">
          <div className="relative inline-block">
            <Shiba size={220} mood="sleep" />
            <div className="absolute -bottom-2 left-1/2 h-6 w-[200px] -translate-x-1/2 rounded-[50%] bg-blush opacity-50" />
          </div>
          <div className="hangul mb-2 mt-8 text-[13px] text-taupe">장바구니가 비어있어요</div>
          <h1 className="mb-3 font-display text-3xl font-bold tracking-[-0.02em] text-soot">
            Tu carrito está durmiendo
          </h1>
          <p className="mb-8 leading-[1.7] text-taupe">
            Despiértalo agregando algo rico. Snacks, skincare y papelería recién llegados de Seúl.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/catalogo" className="btn-primary">
              Explorar catálogo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-12 sm:px-12">
      <h1 className="mb-8 font-display text-3xl font-bold tracking-[-0.02em] text-soot">
        Tu carrito{' '}
        <span className="price-mono text-lg font-normal text-taupe">
          · {itemCount()} {itemCount() === 1 ? 'producto' : 'productos'}
        </span>
      </h1>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <div key={item.id} className="card-hs flex gap-4 p-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-btn bg-cream">
                {item.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- URLs externas sin host fijo; next/image exige remotePatterns */
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="ph h-full w-full !border-0 text-[8px]">·</div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-soot">{item.name}</h3>
                <p className="price-mono text-sm text-soot">{formatCLP(item.priceCLP)}</p>
                <div className="mt-2 flex items-center gap-1">
                  <div className="inline-flex items-center overflow-hidden rounded-chip border border-sand">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      aria-label="Quitar uno"
                      className="px-2.5 py-1.5 text-soot hover:bg-soot/5"
                    >
                      <Icon name="minus" size={13} />
                    </button>
                    <span className="price-mono min-w-8 border-x border-sand px-2 py-1.5 text-center text-[13px]">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      aria-label="Agregar uno"
                      className="px-2.5 py-1.5 text-soot hover:bg-soot/5"
                    >
                      <Icon name="plus" size={13} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="ml-3 text-xs text-taupe underline decoration-sand underline-offset-4 hover:text-alert"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              <p className="price-mono shrink-0 text-sm text-soot">
                {formatCLP(item.priceCLP * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        {/* Resumen */}
        <aside className="card-hs h-fit overflow-hidden lg:sticky lg:top-6">
          <div className="border-b border-sand px-6 py-5">
            <h2 className="font-display text-base font-bold text-soot">Resumen</h2>
          </div>
          <div className="flex flex-col gap-2.5 border-b border-sand p-6 text-sm">
            <div className="flex justify-between">
              <span className="text-taupe">Subtotal</span>
              <span className="price-mono text-soot">{formatCLP(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-taupe">Despacho a domicilio</span>
              <span className="price-mono text-soot">
                {shipping === 0 ? 'Gratis' : formatCLP(shipping)}
              </span>
            </div>
            {shipping > 0 && (
              <p className="text-xs text-taupe">
                Gratis sobre $ 50.000 — o retira gratis en tienda (lo eliges en el pago)
              </p>
            )}
          </div>
          <div className="p-6">
            <div className="mb-6 flex items-baseline justify-between">
              <span className="font-display text-lg font-bold text-soot">Total</span>
              <span className="price-mono text-2xl text-soot">{formatCLP(grandTotal)}</span>
            </div>
            <Link href="/checkout" className="btn-primary w-full justify-center">
              Proceder al pago <Icon name="arrow" size={16} />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
