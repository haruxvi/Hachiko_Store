import Link from 'next/link';
import Shiba from '@/src/components/ui/Shiba';

export const metadata = { title: 'Pago no completado — Hachiko' };

export default function CheckoutFailurePage() {
  return (
    <div className="flex items-center justify-center px-6 py-24 sm:px-12">
      <div className="max-w-[480px] text-center">
        <Shiba size={180} mood="idle" />
        <h1 className="mb-3 mt-8 font-display text-3xl font-bold tracking-[-0.02em] text-soot">
          El pago no se completó
        </h1>
        <p className="mb-8 leading-[1.7] text-taupe">
          No se hizo ningún cargo a tu tarjeta. Tu carrito sigue intacto — puedes intentar de nuevo
          o elegir otro medio de pago.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/checkout" className="btn-primary">
            Reintentar el pago
          </Link>
          <Link href="/carrito" className="btn-link">
            Volver al carrito
          </Link>
        </div>
      </div>
    </div>
  );
}
