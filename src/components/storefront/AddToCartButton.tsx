'use client';

import { useCartStore } from '@/src/lib/stores/cart';

interface Props {
  product: { id: string; name: string; priceCLP: number; image: string | null };
}

export default function AddToCartButton({ product }: Props) {
  const addItem = useCartStore((s) => s.addItem);

  return (
    <button
      onClick={() => addItem({ ...product, quantity: 1 })}
      className="bg-rust text-soot font-semibold py-3 px-8 rounded-full hover:bg-rust transition-colors w-full sm:w-auto"
    >
      Agregar al carrito
    </button>
  );
}
