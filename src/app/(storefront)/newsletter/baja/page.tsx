import type { Metadata } from 'next';
import NewsletterStatusCard from '@/src/components/storefront/NewsletterStatusCard';
import { unsubscribeAction } from '@/src/actions/newsletter';
import { verifyNewsletterToken } from '@/src/lib/newsletter/tokens';

export const metadata: Metadata = {
  title: 'Darse de baja — Hachiko',
  robots: { index: false, follow: false },
};

export default async function BajaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; estado?: string }>;
}) {
  const { token, estado } = await searchParams;

  if (estado === 'ok') {
    return (
      <NewsletterStatusCard title="Listo, te diste de baja">
        <p>No te enviaremos más promociones.</p>
        <p>Seguirás recibiendo los correos de tus pedidos (pago, despacho), que no son publicidad.</p>
      </NewsletterStatusCard>
    );
  }

  if (estado === 'invalido' || !verifyNewsletterToken(token, 'unsub')) {
    return (
      <NewsletterStatusCard title="Enlace no válido">
        <p>No pudimos procesar este enlace. Si quieres dejar de recibir promociones, escríbenos a hachiko.store.contacto@gmail.com.</p>
      </NewsletterStatusCard>
    );
  }

  return (
    <NewsletterStatusCard
      title="¿Dejar de recibir promociones?"
      action={
        <form action={unsubscribeAction}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="btn-primary">
            Darme de baja
          </button>
        </form>
      }
    >
      <p>Dejarás de recibir nuestras promociones por correo. Los correos de tus pedidos seguirán llegando.</p>
    </NewsletterStatusCard>
  );
}
