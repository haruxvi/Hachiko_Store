import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidad — Hachiko',
  description:
    'Cómo Hachiko trata tus datos personales conforme a la Ley 21.719 de Protección de Datos Personales.',
};

const POLICY_VERSION = '1.0';
const POLICY_DATE = '10 de junio de 2026';

export default function PrivacidadPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/" className="text-sm text-rose-600 hover:underline">
        ← Volver a la tienda
      </Link>

      <h1 className="text-3xl font-bold mt-4 mb-2">Política de Privacidad</h1>
      <p className="text-sm text-gray-500 mb-10">
        Versión {POLICY_VERSION} — vigente desde el {POLICY_DATE}. Elaborada conforme a la Ley
        N° 21.719 sobre Protección de Datos Personales.
      </p>

      <div className="space-y-10 text-sm leading-relaxed text-gray-700">
        <Section title="1. Responsable del tratamiento">
          <p>
            Hachiko, tienda de productos coreanos con operación en Santiago, Chile, es el
            responsable del tratamiento de los datos personales recolectados a través de este
            sitio. Contacto para materias de datos personales:{' '}
            <a href="mailto:contacto@hachiko.cl" className="text-rose-600 hover:underline">
              contacto@hachiko.cl
            </a>
            .
          </p>
        </Section>

        <Section title="2. Qué datos tratamos y para qué">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Datos de cuenta</strong> (correo electrónico, nombre, apellido, teléfono):
              para crear y administrar tu cuenta, y comunicarnos contigo sobre tus pedidos.
              Base de licitud: ejecución del contrato.
            </li>
            <li>
              <strong>Datos de despacho</strong> (dirección, comuna, región, teléfono de
              contacto): exclusivamente para entregar tu pedido a través del operador
              logístico. Base de licitud: ejecución del contrato.
            </li>
            <li>
              <strong>Datos de pago</strong>: el pago se procesa directamente en Transbank
              (Webpay) o Mercado Pago. <strong>Hachiko nunca recibe ni almacena el número de
              tu tarjeta</strong>; solo conservamos la referencia de la transacción y su estado.
              Base de licitud: ejecución del contrato.
            </li>
            <li>
              <strong>Registros de seguridad</strong> (dirección IP, identificador del
              navegador, fecha y tipo de evento — por ejemplo, inicios de sesión fallidos):
              para proteger las cuentas, prevenir fraudes y accesos no autorizados, y servir de
              respaldo en caso de denuncia por delito informático (Ley 21.459). Base de
              licitud: interés legítimo en la seguridad de la plataforma y cumplimiento del
              deber de adoptar medidas de seguridad que impone la Ley 21.719.
            </li>
            <li>
              <strong>Registro de consentimiento</strong> (versión aceptada, fecha e IP al
              momento de aceptar): como evidencia de que prestaste tu consentimiento. Base de
              licitud: cumplimiento de obligación legal.
            </li>
            <li>
              <strong>Comunicaciones de marketing</strong>: solo si marcaste la casilla
              correspondiente. Base de licitud: tu consentimiento, que puedes revocar en
              cualquier momento desde tu perfil sin afectar tu cuenta.
            </li>
          </ul>
        </Section>

        <Section title="3. Cuánto tiempo conservamos tus datos">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Datos de cuenta y direcciones</strong>: mientras tu cuenta esté activa.
              Si solicitas la eliminación, se ejecuta dentro del plazo informado en el proceso.
            </li>
            <li>
              <strong>Dirección IP y navegador en registros de seguridad</strong>: se conservan
              <strong> 12 meses</strong> y luego se anonimizan automáticamente (se elimina la IP
              y el navegador, conservando solo el tipo de evento y la fecha como traza de
              auditoría). Este plazo permite investigar incidentes y respaldar denuncias sin
              retener datos personales más de lo necesario.
            </li>
            <li>
              <strong>Datos de pedidos y comprobantes</strong>: se conservan por los plazos que
              exige la normativa tributaria y de protección al consumidor chilena.
            </li>
            <li>
              <strong>Registro de incidencias de seguridad</strong>: la bitácora interna de
              incidentes no contiene datos personales de clientes y se conserva como evidencia
              auditable.
            </li>
          </ul>
        </Section>

        <Section title="4. Con quién compartimos datos">
          <p>
            No vendemos ni cedemos tus datos. Solo los comparten con nosotros, en calidad de
            encargados o terceros necesarios para operar el servicio:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              <strong>Transbank</strong> y <strong>Mercado Pago</strong>: procesamiento de pagos.
            </li>
            <li>
              <strong>Operador logístico (Starken)</strong>: nombre, dirección y teléfono,
              exclusivamente para el despacho.
            </li>
            <li>
              <strong>Proveedores de infraestructura y correo transaccional</strong> (alojamiento
              del sitio, base de datos y envío de correos de pedidos): pueden implicar
              transferencia internacional de datos a proveedores que ofrecen garantías adecuadas
              de seguridad.
            </li>
            <li>
              <strong>Autoridades competentes</strong>: solo ante requerimiento legal o denuncia
              formal (por ejemplo, ante un delito informático), y limitado a lo estrictamente
              necesario.
            </li>
          </ul>
        </Section>

        <Section title="5. Tus derechos (acceso, rectificación, supresión, oposición y portabilidad)">
          <p>La Ley 21.719 te garantiza los derechos a:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              <strong>Acceder</strong> a tus datos y obtener una copia: disponible directamente
              en <em>Mi cuenta → Mis datos → Exportar mis datos</em>.
            </li>
            <li>
              <strong>Rectificar</strong> datos inexactos: editable desde tu perfil.
            </li>
            <li>
              <strong>Suprimir</strong> tus datos (eliminación de cuenta): desde{' '}
              <em>Mi cuenta → Mis datos</em>, sujeto a los plazos de retención legal de los
              registros de venta.
            </li>
            <li>
              <strong>Oponerte</strong> al tratamiento con fines de marketing y{' '}
              <strong>revocar</strong> tu consentimiento en cualquier momento.
            </li>
            <li>
              <strong>Portabilidad</strong>: la exportación se entrega en formato estructurado y
              de uso común (JSON).
            </li>
          </ul>
          <p className="mt-2">
            También puedes ejercer estos derechos escribiendo a{' '}
            <a href="mailto:contacto@hachiko.cl" className="text-rose-600 hover:underline">
              contacto@hachiko.cl
            </a>
            . Si consideras que tu solicitud no fue atendida, puedes reclamar ante la{' '}
            <strong>Agencia de Protección de Datos Personales</strong>.
          </p>
        </Section>

        <Section title="6. Cómo protegemos tus datos">
          <ul className="list-disc pl-5 space-y-2">
            <li>Las contraseñas se almacenan con hash criptográfico (Argon2); nadie puede leerlas.</li>
            <li>
              Los datos de contacto sensibles (como el teléfono) se almacenan cifrados
              (AES-256-GCM).
            </li>
            <li>Toda la comunicación con el sitio viaja cifrada (HTTPS).</li>
            <li>
              Las cuentas se bloquean temporalmente ante intentos repetidos de acceso fallido.
            </li>
            <li>
              Mantenemos un registro interno de incidencias de seguridad con bitácora
              inalterable, que permite auditar la gestión de cualquier incidente y respaldar
              denuncias ante las autoridades (Leyes 21.459 y 21.663).
            </li>
            <li>
              Si una vulneración de seguridad afecta tus datos personales y genera un riesgo
              para ti, te lo notificaremos y lo informaremos a la Agencia de Protección de
              Datos Personales, conforme a la Ley 21.719.
            </li>
          </ul>
        </Section>

        <Section title="7. Cookies">
          <p>
            Usamos únicamente cookies esenciales para el funcionamiento del sitio: mantener tu
            sesión iniciada y tu carrito de compras. No usamos cookies de publicidad ni de
            seguimiento de terceros. Más detalle en la{' '}
            <Link href="/legal/cookies" className="text-rose-600 hover:underline">
              Política de Cookies
            </Link>
            .
          </p>
        </Section>

        <Section title="8. Cambios a esta política">
          <p>
            Si modificamos esta política, publicaremos la nueva versión en esta página con su
            fecha de vigencia. Si el cambio afecta el tratamiento que requiere tu
            consentimiento, te lo pediremos nuevamente antes de aplicarlo.
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
