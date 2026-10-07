import type { Metadata } from 'next';
import NewsletterStatusCard from '@/src/components/storefront/NewsletterStatusCard';
import { confirmSubscriptionAction } from '@/src/actions/newsletter';
import { verifyNewsletterToken } from '@/src/lib/newsletter/tokens';

export const metadata: Metadata = {
  title: 'Confirmar suscripción — Hachiko',
  robots: { index: false, follow: false },
};

export default async function ConfirmarSuscripcionPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; estado?: string }>;
}) {
  const { token, estado } = await searchParams;

  if (estado === 'ok') {
    return (
      <NewsletterStatusCard title="¡Suscripción confirmada!">
        <p>Desde ahora te llegarán nuestras promociones. Puedes darte de baja cuando quieras desde cualquier correo.</p>
      </NewsletterStatusCard>
    );
  }

  if (estado === 'invalido' || !verifyNewsletterToken(token, 'confirm')) {
    return (
      <NewsletterStatusCard title="Enlace no válido">
        <p>El enlace no es válido o ya venció (dura 7 días).</p>
        <p>Puedes volver a suscribirte desde el pie de página de la tienda.</p>
      </NewsletterStatusCard>
    );
  }

  return (
    <NewsletterStatusCard
      title="Confirma tu suscripción"
      action={
        <form action={confirmSubscriptionAction}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="btn-primary">
            Confirmar suscripción
          </button>
        </form>
      }
    >
      <p>Al confirmar, recibirás promociones de Hachiko en este correo. Puedes darte de baja cuando quieras.</p>
    </NewsletterStatusCard>
  );
}
