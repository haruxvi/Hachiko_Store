import Link from 'next/link';
import Logo from '@/src/components/ui/Logo';

// Tarjeta común de las páginas de confirmar suscripción y darse de baja.
export default function NewsletterStatusCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  /** Formulario o botón principal; si no hay, se ofrece volver a la tienda. */
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md py-16">
      <div className="card-hs shadow-soft px-7 py-9 text-center">
        <div className="mb-4 flex justify-center">
          <Logo size={40} />
        </div>
        <h1 className="font-display text-2xl font-bold text-soot">{title}</h1>
        <div className="mt-3 space-y-2 text-[15px] leading-relaxed text-taupe">{children}</div>
        <div className="mt-7">
          {action ?? (
            <Link href="/catalogo" className="btn-primary">
              Ir a la tienda
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
