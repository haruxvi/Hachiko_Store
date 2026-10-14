import Link from 'next/link';
import Shiba from '@/src/components/ui/Shiba';
import PaymentFailureCart from '@/src/components/storefront/PaymentFailureCart';

export const metadata = { title: 'Pago no completado — Hachiko' };

export default async function CheckoutFailurePage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  // "reembolso": el banco cobró, pero el pedido ya no se podía cumplir (se
  // canceló, se agotó o el monto no coincidía). La tienda recibe una alerta.
  const refund = (await searchParams).motivo === 'reembolso';

  return (
    <div className="flex items-center justify-center px-6 py-24 sm:px-12">
      <PaymentFailureCart />
      <div className="max-w-[480px] text-center">
        <Shiba size={180} mood="idle" />
        <h1 className="mb-3 mt-8 font-display text-3xl font-bold tracking-[-0.02em] text-soot">
          {refund ? 'No pudimos completar tu pedido' : 'El pago no se completó'}
        </h1>
        <p className="mb-8 leading-[1.7] text-taupe">
          {refund
            ? 'Recibimos tu pago, pero el pedido ya no estaba disponible (se canceló o se agotó un producto). Te devolveremos el dinero completo y te escribiremos por correo. Tu carrito sigue intacto.'
            : 'No pudimos confirmar este pago. Tu carrito sigue intacto. Revisa tus pedidos antes de intentarlo de nuevo o elegir otro medio de pago.'}
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/checkout" className="btn-primary">
            Reintentar el pago
          </Link>
          <Link href="/carrito" className="btn-link">
            Volver al carrito
          </Link>
          <Link href="/pedidos" className="btn-link">
            Ver mis pedidos
          </Link>
        </div>
      </div>
    </div>
  );
}
