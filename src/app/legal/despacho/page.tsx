import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Envíos a Chile — Hachiko',
  description:
    'Plazos, costos y cobertura de despacho de Hachiko a todo Chile a través de Starken.',
};

const POLICY_DATE = '10 de junio de 2026';

export default function DespachoPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/" className="text-sm text-rose-600 hover:underline">
        ← Volver a la tienda
      </Link>

      <h1 className="text-3xl font-bold mt-4 mb-2">Envíos a Chile</h1>
      <p className="text-sm text-gray-500 mb-10">Última actualización: {POLICY_DATE}.</p>

      <div className="space-y-10 text-sm leading-relaxed text-gray-700">
        <Section title="1. Cobertura">
          <p>
            Despachamos a todo Chile a través de <strong>Starken</strong>. Puedes elegir entrega a
            domicilio o retiro en la sucursal Starken más cercana al momento de finalizar tu compra.
          </p>
        </Section>

        <Section title="2. Plazos de entrega">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Región Metropolitana</strong>: 2 a 4 días hábiles desde la confirmación del
              pago.
            </li>
            <li>
              <strong>Regiones</strong>: 3 a 7 días hábiles, según la comuna de destino y la
              cobertura del operador logístico.
            </li>
            <li>
              Los plazos se cuentan en días hábiles y comienzan una vez confirmado el pago. No
              incluyen fines de semana ni festivos.
            </li>
          </ul>
        </Section>

        <Section title="3. Costos de despacho">
          <p>
            El costo de despacho se calcula automáticamente en el carrito según la comuna de destino
            y el peso del pedido, y se muestra antes de pagar. No hay cargos ocultos: el valor que
            ves en el resumen de compra es el total final.
          </p>
        </Section>

        <Section title="4. Preparación del pedido">
          <p>
            Preparamos los pedidos de lunes a viernes. Las compras realizadas después de las 15:00
            hrs o en días no hábiles se procesan el siguiente día hábil.
          </p>
        </Section>

        <Section title="5. Seguimiento">
          <p>
            Cuando tu pedido es despachado te enviamos un correo con el número de seguimiento de
            Starken para que puedas revisar el estado del envío. También puedes ver el estado de tus
            pedidos en{' '}
            <Link href="/pedidos" className="text-rose-600 hover:underline">
              Mi cuenta → Mis pedidos
            </Link>
            .
          </p>
        </Section>

        <Section title="6. Problemas con la entrega">
          <p>
            Si tu pedido se retrasa más de lo informado, llega dañado o no lo recibes, escríbenos a{' '}
            <a href="mailto:contacto@hachiko.cl" className="text-rose-600 hover:underline">
              contacto@hachiko.cl
            </a>{' '}
            indicando tu número de pedido y te ayudamos a resolverlo. Revisa también nuestra{' '}
            <Link href="/legal/devoluciones" className="text-rose-600 hover:underline">
              política de cambios y devoluciones
            </Link>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      {children}
    </section>
  );
}
