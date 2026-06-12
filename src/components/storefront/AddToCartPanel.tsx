'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/src/lib/stores/cart';
import { formatCLP } from '@/src/lib/format';
import Icon from '@/src/components/ui/Icon';

interface Props {
  product: { id: string; name: string; priceCLP: number; image: string | null };
  maxQty: number;
}

// Stepper de cantidad + CTA rust full-width. Al agregar: toast discreto
// abajo a la izquierda con preview del producto, como pide el brief.
export default function AddToCartPanel({ product, maxQty }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const [qty, setQty] = useState(1);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const add = () => {
    addItem({ ...product, quantity: qty });
    setToast(true);
  };

  return (
    <div>
      <div className="flex items-stretch gap-3">
        <div className="inline-flex items-center overflow-hidden rounded-btn border border-sand">
          <button
            type="button"
            onClick={() => setQty(Math.max(1, qty - 1))}
            aria-label="Quitar uno"
            className="px-3.5 py-3 text-soot hover:bg-soot/5"
          >
            <Icon name="minus" size={16} />
          </button>
          <span className="price-mono min-w-12 border-x border-sand px-4 py-3 text-center text-[15px]">
            {String(qty).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => setQty(Math.min(maxQty, qty + 1))}
            aria-label="Agregar uno"
            className="px-3.5 py-3 text-soot hover:bg-soot/5"
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
        <button type="button" onClick={add} className="btn-primary flex-1 !px-6">
          <Icon name="cart" size={18} /> Agregar al carrito · {formatCLP(product.priceCLP * qty)}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-6 z-50 flex min-w-[280px] max-w-[360px] items-center gap-3 rounded-2xl border border-sand bg-snow p-3.5 shadow-lift">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-chip bg-cream">
            {product.image ? (
              /* eslint-disable-next-line @next/next/no-img-element -- preview de URL externa */
              <img src={product.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="ph h-full w-full !border-0 text-[8px]">·</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-soot">{product.name}</div>
            <div className="text-xs text-taupe">Agregado al carrito</div>
          </div>
          <Link href="/carrito" className="btn-outline btn-sm !px-2.5 !py-1.5">
            Ver carrito
          </Link>
        </div>
      )}
    </div>
  );
}
