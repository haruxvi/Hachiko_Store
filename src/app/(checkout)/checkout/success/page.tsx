import Link from 'next/link';
import { getSession } from '@/src/lib/auth/session';
import { getOrderForClient } from '@/src/lib/services/order.service';
import Shiba from '@/src/components/ui/Shiba';

export const metadata = { title: 'Pedido confirmado — Hachiko' };

function Step({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <li className="flex items-start gap-4">
      <span className="price-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sand bg-cream text-[13px] text-soot">
        {n}
      </span>
      <div>
        <div className="text-[15px] font-semibold text-soot">{title}</div>
        <div className="mt-0.5 text-[13px] text-taupe">{sub}</div>
      </div>
    </li>
  );
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  const session = await getSession();
  const order =
    orderId && session ? await getOrderForClient(orderId, session.sub) : null;

  return (
    <div className="px-6 py-16 sm:px-12">
      <div className="mx-auto max-w-[880px] text-center">
        {/* Shiba feliz + confeti discreto — la mascota aparece acá y en pocos lugares más */}
        <div className="relative mb-6 inline-block">
          <Shiba size={180} mood="happy" />
          <span className="absolute -left-5 top-5 h-2 w-2 rounded-full bg-rust" />
          <span className="absolute -right-2.5 top-[60px] h-1.5 w-1.5 rounded-full bg-blush" />
          <span className="absolute right-5 top-0 h-2.5 w-2.5 rounded-full bg-sky" />
          <span className="absolute -left-2.5 bottom-8 h-1.5 w-1.5 rounded-full bg-sand" />
        </div>

        <div className="hangul mb-2 text-sm text-rust">주문 완료 · 감사합니다</div>
        <h1 className="mb-2 font-display text-3xl font-bold tracking-[-0.02em] text-soot sm:text-[44px] sm:leading-tight">
          Listo. Lo estamos empacando.
        </h1>
        <p className="mb-8 text-[17px] text-taupe">
          Te mandamos la confirmación por email con el detalle de tu pedido.
        </p>

        {order && (
          <div className="mb-12 inline-flex items-baseline gap-4 rounded-card border border-sand bg-snow px-9 py-6">
            <span className="text-[11px] uppercase tracking-[0.08em] text-taupe">Tu orden</span>
            <span className="price-mono text-3xl tracking-[-0.02em] text-soot sm:text-[42px]">
              # {order.orderNumber}
            </span>
          </div>
        )}

        {/* Próximos pasos */}
        <div className="rounded-card border border-sand bg-snow px-6 py-8 text-left sm:px-10">
          <h3 className="mb-5 font-display text-lg font-bold text-soot">Qué pasa ahora</h3>
          <ol className="flex flex-col gap-[18px]">
            <Step n={1} title="Empacamos en bodega" sub="Pedidos antes de las 14:00 salen el mismo día · Recoleta" />
            <Step
              n={2}
              title="Sale con Starken al día siguiente hábil"
              sub="Te llega el tracking por email apenas lo entregamos al courier"
            />
            <Step
              n={3}
              title="Llega a tu casa en 24–48 hrs (RM)"
              sub="Regiones 3–5 días hábiles. Si no estás, retiras en la sucursal más cercana"
            />
          </ol>

          <div className="mt-8 flex flex-col gap-3 border-t border-sand pt-6 sm:flex-row">
            <Link href="/pedidos" className="btn-outline flex-1 justify-center">
              Ver el detalle de la orden
            </Link>
            <Link href="/catalogo" className="btn-primary flex-1 justify-center">
              Seguir comprando
            </Link>
          </div>
        </div>

        <p className="mt-6 text-[13px] text-taupe">
          ¿Algo no calza? Escribinos a{' '}
          <a href="mailto:contacto@hachiko.cl" className="text-rust hover:underline">
            contacto@hachiko.cl
          </a>{' '}
          — respondemos en horario de barrio (10:00–19:00).
        </p>
      </div>
    </div>
  );
}
