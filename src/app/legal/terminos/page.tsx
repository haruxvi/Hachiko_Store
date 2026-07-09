import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos y Condiciones — Hachiko',
  description:
    'Términos y condiciones de uso y compra en Hachiko, incluida la información sobre pago seguro.',
};

const POLICY_VERSION = '1.0';
const POLICY_DATE = '10 de junio de 2026';

export default function TerminosPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/" className="text-sm text-rose-600 hover:underline">
        ← Volver a la tienda
      </Link>

      <h1 className="text-3xl font-bold mt-4 mb-2">Términos y Condiciones</h1>
      <p className="text-sm text-gray-500 mb-10">
        Versión {POLICY_VERSION} — vigente desde el {POLICY_DATE}.
      </p>

      <div className="space-y-10 text-sm leading-relaxed text-gray-700">
        <Section title="1. Quiénes somos">
          <p>
            Hachiko es una tienda de productos coreanos con operación en Santiago, Chile. Estos
            términos regulan el uso del sitio y la compra de productos a través de él. Al comprar o
            crear una cuenta aceptas estas condiciones.
          </p>
        </Section>

        <Section title="2. Cuenta de usuario">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Eres responsable de mantener la confidencialidad de tu contraseña y de la actividad
              realizada desde tu cuenta.
            </li>
            <li>Debes entregar datos verídicos y mantenerlos actualizados.</li>
            <li>
              Podemos suspender cuentas ante uso fraudulento o que infrinja estos términos o la ley.
            </li>
          </ul>
        </Section>

        <Section title="3. Productos, precios y disponibilidad">
          <p>
            Los precios se muestran en pesos chilenos (CLP) e incluyen IVA. Procuramos que la
            información de productos, stock y precios sea exacta; si detectamos un error evidente en
            un precio o en la disponibilidad, podremos anular el pedido afectado y reembolsar lo
            pagado. La compra queda sujeta a disponibilidad de stock.
          </p>
        </Section>

        <Section title="4. Pago seguro">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Los pagos se procesan directamente en <strong>Transbank (Webpay)</strong> o{' '}
              <strong>Mercado Pago</strong>. Toda la comunicación con el sitio viaja cifrada (HTTPS).
            </li>
            <li>
              <strong>Hachiko nunca recibe ni almacena el número de tu tarjeta</strong>; solo
              conservamos la referencia de la transacción y su estado.
            </li>
            <li>
              El pedido se confirma una vez que el medio de pago aprueba la transacción. Si el pago
              es rechazado, el pedido no se procesa.
            </li>
          </ul>
        </Section>

        <Section title="5. Despacho">
          <p>
            Los plazos, costos y cobertura de envío se detallan en la política de{' '}
            <Link href="/legal/despacho" className="text-rose-600 hover:underline">
              Envíos a Chile
            </Link>
            .
          </p>
        </Section>

        <Section title="6. Cambios, devoluciones y garantía">
          <p>
            Tus derechos de retracto, cambio y garantía legal se rigen por la Ley N° 19.496 y se
            detallan en la política de{' '}
            <Link href="/legal/devoluciones" className="text-rose-600 hover:underline">
              Cambios y devoluciones
            </Link>
            .
          </p>
        </Section>

        <Section title="7. Datos personales">
          <p>
            El tratamiento de tus datos se rige por nuestra{' '}
            <Link href="/legal/privacidad" className="text-rose-600 hover:underline">
              Política de Privacidad
            </Link>
            , elaborada conforme a la Ley N° 21.719.
          </p>
        </Section>

        <Section title="8. Propiedad intelectual">
          <p>
            Los contenidos del sitio (textos, imágenes, logotipos y marcas) están protegidos y no
            pueden reproducirse sin autorización, salvo el uso normal necesario para comprar en la
            tienda.
          </p>
        </Section>

        <Section title="9. Responsabilidad">
          <p>
            Nos esforzamos por mantener el sitio disponible y libre de errores, pero no garantizamos
            su funcionamiento ininterrumpido. Nuestra responsabilidad se limita a lo que exige la
            normativa chilena de protección al consumidor.
          </p>
        </Section>

        <Section title="10. Legislación aplicable y contacto">
          <p>
            Estos términos se rigen por la ley chilena. Para cualquier consulta escríbenos a{' '}
            <a href="mailto:contacto@hachiko.cl" className="text-rose-600 hover:underline">
              contacto@hachiko.cl
            </a>
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
