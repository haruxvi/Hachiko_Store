'use client';

import Link from 'next/link';
import { useCartStore } from '@/src/lib/stores/cart';
import { calculateShipping } from '@/src/lib/shipping';

export default function CartClient() {
  const { items, removeItem, updateQuantity, total, itemCount } = useCartStore();
  const subtotal = total();
  const shipping = calculateShipping(subtotal);
  const grandTotal = subtotal + shipping;

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-2xl mb-4">Tu carrito está vacío</p>
        <Link href="/catalogo" className="text-rose-500 hover:underline font-medium">
          Ir al catálogo →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-8">Carrito ({itemCount()} productos)</h1>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 flex flex-col gap-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 border rounded-xl p-4">
              <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                {item.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- URLs externas sin host fijo; next/image exige remotePatterns */
                  <img src={item.image} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">🛍️</div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-medium">{item.name}</h3>
                <p className="text-rose-600 font-bold">${item.priceCLP.toLocaleString('es-CL')}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-gray-100"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-gray-100"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="ml-4 text-xs text-gray-400 hover:text-red-500"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              <p className="font-bold text-sm shrink-0">
                ${(item.priceCLP * item.quantity).toLocaleString('es-CL')}
              </p>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-2xl p-6 h-fit">
          <h2 className="font-bold mb-4">Resumen</h2>
          <div className="flex justify-between text-sm mb-2">
            <span>Subtotal</span>
            <span>${subtotal.toLocaleString('es-CL')}</span>
          </div>
          <div className="flex justify-between text-sm mb-4">
            <span>Despacho a domicilio</span>
            <span>{shipping === 0 ? 'Gratis' : `$${shipping.toLocaleString('es-CL')}`}</span>
          </div>
          {shipping > 0 && (
            <p className="text-xs text-gray-400 mb-4">
              Gratis sobre $50.000 — o retira gratis en tienda (lo eliges en el pago)
            </p>
          )}
          <div className="border-t pt-4 flex justify-between font-bold mb-6">
            <span>Total</span>
            <span>${grandTotal.toLocaleString('es-CL')}</span>
          </div>
          <Link
            href="/checkout"
            className="block bg-rose-500 text-white text-center font-semibold py-3 rounded-full hover:bg-rose-600 transition-colors"
          >
            Proceder al pago
          </Link>
        </div>
      </div>
    </div>
  );
}
