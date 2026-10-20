import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/src/lib/auth/session';
import { getReturnableOrder, GARANTIA_MONTHS, RETRACTO_DAYS } from '@/src/lib/services/returns.service';
import ReturnRequestForm from '@/src/components/storefront/ReturnRequestForm';
import { DbIdSchema } from '@/src/lib/validation/schemas';

export const metadata = { title: 'Solicitar cambio o devolución — Hachiko' };

const dateLabel = (d: Date) =>
  d.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'long', year: 'numeric' });

export default async function DevolucionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  if (!DbIdSchema.safeParse(id).success) notFound();
  const order = await getReturnableOrder(id, session.sub);
  if (!order) notFound();

  const back = (
    <Link href="/pedidos" className="btn-link">
      Volver a mis pedidos
    </Link>
  );

  // Tras enviar, la acción revalida y esta página vuelve a renderizarse: por eso el caso
  // "solicitud en curso" se lee como confirmación, no como error.
  let title: string | null = null;
  let blocker: string | null = null;
  if (order.openRequest && order.eligible) {
    title = `Solicitud #${order.openRequest} en curso`;
    blocker = 'Te escribimos por correo con los pasos para entregarnos el producto y cada vez que avance. Puedes ver su estado en Mis pedidos.';
  } else if (!order.eligible) blocker = 'Podrás pedir un cambio o devolución cuando el pedido figure como entregado.';
  else if (!order.windows?.GARANTIA.open) blocker = `Pasaron más de ${GARANTIA_MONTHS} meses desde que recibiste el pedido, así que ya no aplica la garantía legal.`;
  else if (order.items.every((i) => i.returnable === 0)) blocker = 'Todos los productos de este pedido ya están incluidos en otras solicitudes.';

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="mb-1 text-sm text-taupe">Pedido #{order.orderNumber}</p>
      <h1 className="mb-2 text-2xl font-bold">Solicitar cambio o devolución</h1>
      <p className="editorial mb-8 text-[15px] text-taupe">Tus derechos según la Ley del Consumidor, en pocos pasos.</p>

      {blocker ? (
        <div className="rounded-card border border-sand bg-cream px-5 py-6">
          {title && <p className="mb-2 font-display text-lg font-bold text-soot">{title}</p>}
          <p className="text-sm leading-relaxed text-soot">{blocker}</p>
          <div className="mt-4">{back}</div>
        </div>
      ) : (
        <ReturnRequestForm
          orderId={order.id}
          items={order.items}
          windows={{
            RETRACTO: { open: order.windows!.RETRACTO.open, until: dateLabel(order.windows!.RETRACTO.until) },
            GARANTIA: { open: order.windows!.GARANTIA.open, until: dateLabel(order.windows!.GARANTIA.until) },
          }}
          retractoDays={RETRACTO_DAYS}
          garantiaMonths={GARANTIA_MONTHS}
        />
      )}

      <p className="mt-8 text-xs leading-relaxed text-taupe">
        Más detalles en nuestra{' '}
        <Link href="/legal/devoluciones" className="text-rust-ink hover:underline">
          política de cambios y devoluciones
        </Link>
        .
      </p>
    </div>
  );
}
