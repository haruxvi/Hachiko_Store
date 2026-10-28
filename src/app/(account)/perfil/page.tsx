import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { OrderStatus, ShippingMethod } from '@prisma/client';
import { getSession } from '@/src/lib/auth/session';
import { getUserProfile } from '@/src/lib/services/auth.service';
import { getAccountSummary } from '@/src/lib/services/customer.service';
import MemberCard from '@/src/components/account/MemberCard';
import ProfileDetails from '@/src/components/account/ProfileDetails';
import MarketingToggle from '@/src/components/account/MarketingToggle';
import TwoFactorSetup from '@/src/components/storefront/TwoFactorSetup';
import LogoutButton from '@/src/components/storefront/LogoutButton';
import ResendVerificationButton from '@/src/components/storefront/ResendVerificationButton';

export const metadata: Metadata = {
  title: 'Mi perfil — Hachiko',
  robots: { index: false, follow: false },
};

// Composición: un solo elemento protagonista (el carnet) y el resto sereno, en
// columnas asimétricas 7/5 en escritorio y una sola columna en celular. Cada
// sección tiene un tratamiento propio según lo que es (ficha editable, interruptor,
// lista de estado, texto), en vez de la misma tarjeta repetida.

const focusRing = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/40';

function lastOrderSentence(n: number, status: OrderStatus, method: ShippingMethod) {
  const pickup = method === 'PICKUP';
  const id = <span className="price-mono">#{n}</span>;
  switch (status) {
    case 'PAID':
      return <>Tu último pedido, {id}, ya tiene el pago confirmado.</>;
    case 'PREPARING':
      return <>Tu último pedido, {id}, se está preparando.</>;
    case 'SHIPPED':
      return pickup ? <>Tu último pedido, {id}, está listo para retirar.</> : <>Tu último pedido, {id}, va en camino.</>;
    case 'DELIVERED':
      return pickup ? <>Tu último pedido, {id}, ya lo retiraste.</> : <>Tu último pedido, {id}, ya fue entregado.</>;
    case 'CANCELLED':
      return <>Tu último pedido, {id}, fue cancelado.</>;
    default:
      return <>Tu último pedido es el {id}.</>;
  }
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full ${ok ? 'bg-mint-deep' : 'border-2 border-taupe-deep/60'}`}
    />
  );
}

export default async function PerfilPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [profile, summary] = await Promise.all([getUserProfile(session.sub), getAccountSummary(session.sub)]);
  if (!profile) redirect('/login');

  const isSeller = profile.role === 'SELLER';
  const verified = profile.emailVerified !== null;
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Tu cuenta';
  const { orderCount, lastOrder } = summary;

  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
      <h1 className="sr-only">Mi perfil</h1>

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-12">
        {/* ── Protagonista ── */}
        <div className="lg:col-span-7">
          <MemberCard
            name={name}
            email={profile.email}
            isSeller={isSeller}
            memberSince={profile.createdAt}
            verified={verified}
          />
        </div>

        {/* ── Accesos: lo que más se viene a buscar ── */}
        <div className="space-y-4 lg:col-span-5 lg:pt-8">
          <section aria-labelledby="pedidos-title" className="rounded-[22px] border border-sand bg-snow p-6">
            <h2 id="pedidos-title" className="font-display text-xl font-bold text-soot">
              Tus pedidos
            </h2>
            {orderCount === 0 ? (
              <>
                <p className="mt-2 text-[15px] leading-relaxed text-taupe-deep">
                  Todavía no has comprado nada. Cuando lo hagas, aquí verás en qué va tu pedido.
                </p>
                <Link href="/catalogo" className={`btn-outline btn-sm mt-4 min-h-11 ${focusRing}`}>
                  Ver el catálogo
                </Link>
              </>
            ) : (
              <>
                <p className="mt-2 text-[15px] leading-relaxed text-soot">
                  {lastOrder && lastOrderSentence(lastOrder.orderNumber, lastOrder.status, lastOrder.shippingMethod)}
                </p>
                <p className="mt-1 text-sm text-taupe-deep">
                  {orderCount === 1 ? 'Es tu primera compra.' : `Llevas ${orderCount} compras en Hachiko.`}
                </p>
                <Link href="/pedidos" className={`btn-outline btn-sm mt-4 min-h-11 ${focusRing}`}>
                  Ver mis pedidos
                </Link>
              </>
            )}
          </section>

          {isSeller && (
            <section aria-labelledby="trastienda-title" className="rounded-[22px] bg-tan-soft p-6">
              <h2 id="trastienda-title" className="font-display text-xl font-bold text-soot">
                La trastienda
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-soot/85">
                Pedidos por despachar, productos, inventario y promociones.
              </p>
              <Link href="/trastienda" className={`btn-primary btn-sm mt-4 min-h-11 ${focusRing}`}>
                Ir a la trastienda
              </Link>
            </section>
          )}
        </div>

        {/* ── Tus datos, preferencias y privacidad ── */}
        <div className="space-y-8 lg:col-span-7">
          <ProfileDetails firstName={profile.firstName ?? ''} lastName={profile.lastName ?? ''} phone={profile.phone} />
          <MarketingToggle initial={profile.consentMarketing} verified={verified} />
          <section aria-labelledby="privacidad-title" className="border-t border-sand pt-7">
            <h2 id="privacidad-title" className="font-display text-xl font-bold text-soot">
              Tus datos personales
            </h2>
            <p className="mt-2 max-w-[44ch] text-[15px] leading-relaxed text-taupe-deep">
              Puedes descargar una copia de todo lo que guardamos sobre ti, o pedir que eliminemos tu cuenta,
              cuando quieras. Es tu derecho según la Ley 21.719.
            </p>
            <Link
              href="/datos"
              className={`mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-soot underline decoration-rust decoration-2 underline-offset-4 hover:decoration-soot ${focusRing}`}
            >
              Descargar o eliminar mis datos
            </Link>
          </section>

        </div>

        {/* ── Seguridad ── */}
        <div className="space-y-10 lg:col-span-5">
          <section aria-labelledby="seguridad-title">
            <h2 id="seguridad-title" className="font-display text-xl font-bold text-soot">
              Seguridad
            </h2>
            <ul className="mt-4 divide-y divide-sand">
              <li className="pb-5">
                <div className="flex items-start gap-3">
                  <StatusDot ok={verified} />
                  <div>
                    <h3 className="text-[15px] font-semibold text-soot">
                      {verified ? 'Correo verificado' : 'Correo sin verificar'}
                    </h3>
                    <p className="mt-1 max-w-[42ch] text-sm leading-relaxed text-taupe-deep">
                      {verified
                        ? 'Te llegan sin problemas la confirmación de tus compras y el seguimiento de tus envíos.'
                        : 'Verifícalo para asegurarte de recibir la confirmación de tus compras y el seguimiento de tus envíos.'}
                    </p>
                    {!verified && (
                      <div className="mt-2">
                        <ResendVerificationButton />
                      </div>
                    )}
                  </div>
                </div>
              </li>
              <li className="pt-5">
                <TwoFactorSetup enabled={profile.totpEnabledAt !== null} />
              </li>
            </ul>
          </section>

          <div className="border-t border-sand pt-6">
            <LogoutButton
              className={`inline-flex min-h-11 items-center text-sm font-medium text-taupe-deep hover:text-soot ${focusRing}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
