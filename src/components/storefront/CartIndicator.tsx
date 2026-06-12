'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCartStore } from '@/src/lib/stores/cart';
import Icon from '@/src/components/ui/Icon';

// El contador vive en zustand (localStorage): se monta en cliente para evitar
// desajustes de hidratación con el render del servidor. El selector devuelve
// el número (no la función itemCount) para re-renderizar cuando cambia el carrito.
export default function CartIndicator() {
  const liveCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? liveCount : 0;

  return (
    <Link
      href="/carrito"
      aria-label={`Carrito (${count} productos)`}
      className="btn-ghost btn-sm relative !p-2"
    >
      <Icon name="cart" size={20} />
      {count > 0 && (
        <span className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rust px-[5px] font-mono text-[11px] font-bold text-snow">
          {count}
        </span>
      )}
    </Link>
  );
}
