import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Cookies — Hachiko',
  description:
    'Qué cookies usa Hachiko. Solo usamos cookies esenciales para la sesión y el carrito.',
};

const POLICY_DATE = '10 de junio de 2026';

export default function CookiesPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/" className="text-sm text-rose-600 hover:underline">
        ← Volver a la tienda
      </Link>

      <h1 className="text-3xl font-bold mt-4 mb-2">Política de Cookies</h1>
      <p className="text-sm text-gray-500 mb-10">Última actualización: {POLICY_DATE}.</p>

      <div className="space-y-10 text-sm leading-relaxed text-gray-700">
        <Section title="1. Qué son las cookies">
          <p>
            Las cookies son pequeños archivos que un sitio guarda en tu navegador para recordar
            información entre páginas y visitas. También usamos tecnologías equivalentes de
            almacenamiento local para el mismo fin.
          </p>
        </Section>

        <Section title="2. Qué cookies usamos">
          <p>
            En Hachiko usamos únicamente <strong>cookies esenciales</strong>, necesarias para que el
            sitio funcione:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              <strong>Sesión</strong>: mantiene tu sesión iniciada de forma segura mientras navegas.
            </li>
            <li>
              <strong>Carrito</strong>: recuerda los productos que agregaste para poder finalizar tu
              compra.
            </li>
          </ul>
          <p className="mt-2">
            <strong>No usamos cookies de publicidad ni de seguimiento de terceros</strong>, ni
            elaboramos perfiles con fines comerciales.
          </p>
        </Section>

        <Section title="3. Cookies estrictamente necesarias">
          <p>
            Como estas cookies son imprescindibles para prestar el servicio que solicitas (iniciar
            sesión y comprar), no requieren consentimiento previo. Sin ellas el sitio no puede
            funcionar correctamente.
          </p>
        </Section>

        <Section title="4. Cómo controlarlas">
          <p>
            Puedes eliminar o bloquear las cookies desde la configuración de tu navegador. Ten en
            cuenta que si bloqueas las cookies esenciales no podrás iniciar sesión ni completar una
            compra.
          </p>
        </Section>

        <Section title="5. Más información">
          <p>
            El tratamiento de datos asociado se describe en nuestra{' '}
            <Link href="/legal/privacidad" className="text-rose-600 hover:underline">
              Política de Privacidad
            </Link>
            . Ante cualquier duda, escríbenos a{' '}
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
