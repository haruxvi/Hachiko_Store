import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cambios y devoluciones — Hachiko',
  description:
    'Cómo solicitar un cambio o devolución en Hachiko conforme a la Ley del Consumidor chilena.',
};

const POLICY_DATE = '10 de junio de 2026';

export default function DevolucionesPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/" className="text-sm text-rose-600 hover:underline">
        ← Volver a la tienda
      </Link>

      <h1 className="text-3xl font-bold mt-4 mb-2">Cambios y devoluciones</h1>
      <p className="text-sm text-gray-500 mb-10">Última actualización: {POLICY_DATE}.</p>

      <div className="space-y-10 text-sm leading-relaxed text-gray-700">
        <Section title="1. Garantía legal">
          <p>
            Todos los productos cuentan con la garantía legal que establece la Ley N° 19.496 sobre
            Protección de los Derechos de los Consumidores. Si un producto llega con fallas, dañado o
            no corresponde a lo que compraste, tienes derecho a su cambio, reparación o a la
            devolución de lo pagado.
          </p>
        </Section>

        <Section title="2. Plazo para solicitarlo">
          <p>
            Puedes solicitar un cambio o devolución dentro de los <strong>10 días corridos</strong>{' '}
            siguientes a la recepción de tu pedido. Para productos con falla, la garantía legal rige
            por los plazos que establece la ley aunque hayan pasado esos 10 días.
          </p>
        </Section>

        <Section title="3. Condiciones">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              El producto debe estar sin uso, con su embalaje y sellos originales cuando aplique.
            </li>
            <li>
              Por razones sanitarias, los productos de <strong>alimentación (snacks)</strong> y{' '}
              <strong>skincare</strong> abiertos solo se aceptan si presentan una falla de calidad o
              vienen en mal estado.
            </li>
            <li>Es necesario contar con el número de pedido o el comprobante de compra.</li>
          </ul>
        </Section>

        <Section title="4. Cómo solicitarlo">
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Escríbenos a{' '}
              <a href="mailto:contacto@hachiko.cl" className="text-rose-600 hover:underline">
                contacto@hachiko.cl
              </a>{' '}
              indicando tu número de pedido y el motivo.
            </li>
            <li>Te confirmamos si corresponde cambio, reparación o devolución del dinero.</li>
            <li>Coordinamos contigo el retiro o el reenvío del producto a través de Starken.</li>
          </ol>
        </Section>

        <Section title="5. Reembolsos">
          <p>
            Cuando corresponda una devolución del dinero, el reembolso se realiza por el mismo medio
            de pago utilizado (Webpay o Mercado Pago). El tiempo en que verás el reembolso reflejado
            depende de los plazos de tu banco o del emisor de tu tarjeta.
          </p>
        </Section>

        <Section title="6. Costos de despacho en la devolución">
          <p>
            Si la devolución se debe a una falla del producto o a un error nuestro, asumimos el costo
            del despacho de retorno. En cambio, por retracto o cambio de opinión, el costo del envío
            de retorno es de cargo del cliente.
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
