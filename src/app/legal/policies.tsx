import Link from 'next/link';
import type { ReactNode } from 'react';

// Contenido de las páginas legales, estructurado para el layout editorial
// (rediseño importado desde Claude Design · proyecto Hachiko_Store).
// El texto conserva la redacción legal chilena existente; el diseño solo
// cambia la presentación (barra superior + sidebar + secciones numeradas).

export type PolicySlug =
  | 'privacidad'
  | 'devoluciones'
  | 'despacho'
  | 'terminos'
  | 'cookies';

type Block =
  | { kind: 'p'; content: ReactNode }
  | { kind: 'list'; items: ReactNode[] }
  | { kind: 'steps'; items: ReactNode[] }
  | { kind: 'note'; content: ReactNode };

export type Section = { h: string; blocks: Block[] };

export type Policy = {
  slug: PolicySlug;
  label: string; // etiqueta corta para el sidebar
  title: string;
  meta: string;
  intro: string;
  law: string | null;
  metaTitle: string;
  metaDescription: string;
  sections: Section[];
};

// Orden de navegación en el sidebar (igual que el diseño importado).
export const ORDER: PolicySlug[] = [
  'privacidad',
  'devoluciones',
  'despacho',
  'terminos',
  'cookies',
];

const mailto = (
  <a href="mailto:contacto@hachiko.cl" className="font-medium text-rust hover:underline">
    contacto@hachiko.cl
  </a>
);

const POLICIES: Record<PolicySlug, Policy> = {
  privacidad: {
    slug: 'privacidad',
    label: 'Privacidad',
    title: 'Política de Privacidad',
    meta: 'Versión 1.0 — vigente desde el 10 de junio de 2026',
    intro:
      'Cómo tratamos tus datos personales, conforme a la Ley N° 21.719. En resumen: pedimos lo mínimo, lo cuidamos, y puedes ejercer tus derechos cuando quieras.',
    law: 'Ley N° 21.719 · Protección de Datos Personales',
    metaTitle: 'Política de Privacidad — Hachiko',
    metaDescription:
      'Cómo Hachiko trata tus datos personales conforme a la Ley 21.719 de Protección de Datos Personales.',
    sections: [
      {
        h: 'Responsable del tratamiento',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Hachiko, tienda de productos coreanos con operación en Santiago, Chile, es el
                responsable del tratamiento de los datos personales recolectados a través de este
                sitio. Contacto para materias de datos personales: {mailto}.
              </>
            ),
          },
        ],
      },
      {
        h: 'Qué datos tratamos y para qué',
        blocks: [
          {
            kind: 'list',
            items: [
              <>
                <strong>Datos de cuenta</strong> (correo electrónico, nombre, apellido, teléfono):
                para crear y administrar tu cuenta, y comunicarnos contigo sobre tus pedidos. Base de
                licitud: ejecución del contrato.
              </>,
              <>
                <strong>Datos de despacho</strong> (dirección, comuna, región, teléfono de contacto):
                exclusivamente para entregar tu pedido a través del operador logístico. Base de
                licitud: ejecución del contrato.
              </>,
              <>
                <strong>Datos de pago</strong>: el pago se procesa directamente en Transbank (Webpay)
                o Mercado Pago. <strong>Hachiko nunca recibe ni almacena el número de tu tarjeta</strong>;
                solo conservamos la referencia de la transacción y su estado. Base de licitud:
                ejecución del contrato.
              </>,
              <>
                <strong>Registros de seguridad</strong> (dirección IP, identificador del navegador,
                fecha y tipo de evento — por ejemplo, inicios de sesión fallidos): para proteger las
                cuentas, prevenir fraudes y accesos no autorizados, y servir de respaldo en caso de
                denuncia por delito informático (Ley 21.459). Base de licitud: interés legítimo en la
                seguridad de la plataforma y cumplimiento del deber de adoptar medidas de seguridad
                que impone la Ley 21.719.
              </>,
              <>
                <strong>Registro de consentimiento</strong> (versión aceptada, fecha e IP al momento
                de aceptar): como evidencia de que prestaste tu consentimiento. Base de licitud:
                cumplimiento de obligación legal.
              </>,
              <>
                <strong>Comunicaciones de marketing</strong>: solo si marcaste la casilla
                correspondiente. Base de licitud: tu consentimiento, que puedes revocar en cualquier
                momento desde tu perfil sin afectar tu cuenta.
              </>,
            ],
          },
        ],
      },
      {
        h: 'Cuánto tiempo conservamos tus datos',
        blocks: [
          {
            kind: 'list',
            items: [
              <>
                <strong>Datos de cuenta y direcciones</strong>: mientras tu cuenta esté activa. Si
                solicitas la eliminación, se ejecuta dentro del plazo informado en el proceso.
              </>,
              <>
                <strong>Dirección IP y navegador en registros de seguridad</strong>: se conservan{' '}
                <strong>12 meses</strong> y luego se anonimizan automáticamente (se elimina la IP y el
                navegador, conservando solo el tipo de evento y la fecha como traza de auditoría).
                Este plazo permite investigar incidentes y respaldar denuncias sin retener datos
                personales más de lo necesario.
              </>,
              <>
                <strong>Datos de pedidos y comprobantes</strong>: se conservan por los plazos que
                exige la normativa tributaria y de protección al consumidor chilena.
              </>,
              <>
                <strong>Registro de incidencias de seguridad</strong>: la bitácora interna de
                incidentes no contiene datos personales de clientes y se conserva como evidencia
                auditable.
              </>,
            ],
          },
        ],
      },
      {
        h: 'Con quién compartimos datos',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                No vendemos ni cedemos tus datos. Solo los comparten con nosotros, en calidad de
                encargados o terceros necesarios para operar el servicio:
              </>
            ),
          },
          {
            kind: 'list',
            items: [
              <>
                <strong>Transbank</strong> y <strong>Mercado Pago</strong>: procesamiento de pagos.
              </>,
              <>
                <strong>Operador logístico (Starken)</strong>: nombre, dirección y teléfono,
                exclusivamente para el despacho.
              </>,
              <>
                <strong>Proveedores de infraestructura y correo transaccional</strong> (alojamiento
                del sitio, base de datos y envío de correos de pedidos): pueden implicar transferencia
                internacional de datos a proveedores que ofrecen garantías adecuadas de seguridad.
              </>,
              <>
                <strong>Autoridades competentes</strong>: solo ante requerimiento legal o denuncia
                formal (por ejemplo, ante un delito informático), y limitado a lo estrictamente
                necesario.
              </>,
            ],
          },
        ],
      },
      {
        h: 'Tus derechos (ARCOP)',
        blocks: [
          {
            kind: 'p',
            content: <>La Ley 21.719 te garantiza los derechos a:</>,
          },
          {
            kind: 'list',
            items: [
              <>
                <strong>Acceder</strong> a tus datos y obtener una copia: disponible directamente en{' '}
                <em>Mi cuenta → Mis datos → Exportar mis datos</em>.
              </>,
              <>
                <strong>Rectificar</strong> datos inexactos: editable desde tu perfil.
              </>,
              <>
                <strong>Cancelar / suprimir</strong> tus datos (eliminación de cuenta): desde{' '}
                <em>Mi cuenta → Mis datos</em>, sujeto a los plazos de retención legal de los
                registros de venta.
              </>,
              <>
                <strong>Oponerte</strong> al tratamiento con fines de marketing y{' '}
                <strong>revocar</strong> tu consentimiento en cualquier momento.
              </>,
              <>
                <strong>Portabilidad</strong>: la exportación se entrega en formato estructurado y de
                uso común (JSON).
              </>,
            ],
          },
          {
            kind: 'p',
            content: (
              <>
                También puedes ejercer estos derechos escribiendo a {mailto}. Si consideras que tu
                solicitud no fue atendida, puedes reclamar ante la{' '}
                <strong>Agencia de Protección de Datos Personales</strong>.
              </>
            ),
          },
        ],
      },
      {
        h: 'Cómo protegemos tus datos',
        blocks: [
          {
            kind: 'list',
            items: [
              <>Las contraseñas se almacenan con hash criptográfico (Argon2); nadie puede leerlas.</>,
              <>Los datos de contacto sensibles (como el teléfono) se almacenan cifrados (AES-256-GCM).</>,
              <>Toda la comunicación con el sitio viaja cifrada (HTTPS).</>,
              <>Las cuentas se bloquean temporalmente ante intentos repetidos de acceso fallido.</>,
              <>
                Mantenemos un registro interno de incidencias de seguridad con bitácora inalterable,
                que permite auditar la gestión de cualquier incidente y respaldar denuncias ante las
                autoridades (Leyes 21.459 y 21.663).
              </>,
              <>
                Si una vulneración de seguridad afecta tus datos personales y genera un riesgo para
                ti, te lo notificaremos y lo informaremos a la Agencia de Protección de Datos
                Personales, conforme a la Ley 21.719.
              </>,
            ],
          },
        ],
      },
      {
        h: 'Cookies y cambios a esta política',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Usamos únicamente cookies esenciales para el funcionamiento del sitio: mantener tu
                sesión iniciada y tu carrito de compras. Más detalle en la{' '}
                <Link href="/legal/cookies" className="font-medium text-rust hover:underline">
                  Política de Cookies
                </Link>
                . Si modificamos esta política publicaremos la nueva versión en esta página con su
                fecha de vigencia; si el cambio afecta un tratamiento que requiere tu consentimiento,
                te lo pediremos nuevamente antes de aplicarlo.
              </>
            ),
          },
        ],
      },
    ],
  },

  devoluciones: {
    slug: 'devoluciones',
    label: 'Cambios y devoluciones',
    title: 'Cambios y devoluciones',
    meta: 'Última actualización: 10 de junio de 2026',
    intro:
      'Si algo llegó con falla o no era lo que esperabas, lo resolvemos. Tus derechos se rigen por la Ley del Consumidor.',
    law: 'Ley N° 19.496 · Protección de los Derechos de los Consumidores',
    metaTitle: 'Cambios y devoluciones — Hachiko',
    metaDescription:
      'Cómo solicitar un cambio o devolución en Hachiko conforme a la Ley del Consumidor chilena.',
    sections: [
      {
        h: 'Garantía legal',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Todos los productos cuentan con la garantía legal que establece la Ley N° 19.496 sobre
                Protección de los Derechos de los Consumidores. Si un producto llega con fallas, dañado
                o no corresponde a lo que compraste, tienes derecho a su cambio, reparación o a la
                devolución de lo pagado.
              </>
            ),
          },
        ],
      },
      {
        h: 'Plazo para solicitarlo',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Puedes solicitar un cambio o devolución dentro de los <strong>10 días corridos</strong>{' '}
                siguientes a la recepción de tu pedido. Para productos con falla, la garantía legal
                rige por los plazos que establece la ley aunque hayan pasado esos 10 días.
              </>
            ),
          },
        ],
      },
      {
        h: 'Condiciones',
        blocks: [
          {
            kind: 'list',
            items: [
              <>El producto debe estar sin uso, con su embalaje y sellos originales cuando aplique.</>,
              <>
                Por razones sanitarias, los productos de <strong>alimentación (snacks)</strong> y{' '}
                <strong>skincare</strong> abiertos solo se aceptan si presentan una falla de calidad o
                vienen en mal estado.
              </>,
              <>Es necesario contar con el número de pedido o el comprobante de compra.</>,
            ],
          },
        ],
      },
      {
        h: 'Cómo solicitarlo',
        blocks: [
          {
            kind: 'steps',
            items: [
              <>Escríbenos a {mailto} indicando tu número de pedido y el motivo.</>,
              <>Te confirmamos si corresponde cambio, reparación o devolución del dinero.</>,
              <>Coordinamos contigo el retiro o el reenvío del producto a través de Starken.</>,
            ],
          },
        ],
      },
      {
        h: 'Reembolsos',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Cuando corresponda una devolución del dinero, el reembolso se realiza por el mismo
                medio de pago utilizado (Webpay o Mercado Pago). El tiempo en que verás el reembolso
                reflejado depende de los plazos de tu banco o del emisor de tu tarjeta.
              </>
            ),
          },
        ],
      },
      {
        h: 'Costos de despacho en la devolución',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Si la devolución se debe a una falla del producto o a un error nuestro, asumimos el
                costo del despacho de retorno. En cambio, por retracto o cambio de opinión, el costo
                del envío de retorno es de cargo del cliente.
              </>
            ),
          },
        ],
      },
    ],
  },

  despacho: {
    slug: 'despacho',
    label: 'Envíos a Chile',
    title: 'Envíos a Chile',
    meta: 'Última actualización: 10 de junio de 2026',
    intro:
      'Despachamos a todo Chile desde Recoleta, vía Starken. Sin cargos ocultos: el valor que ves en el resumen es el total final.',
    law: null,
    metaTitle: 'Envíos a Chile — Hachiko',
    metaDescription:
      'Plazos, costos y cobertura de despacho de Hachiko a todo Chile a través de Starken.',
    sections: [
      {
        h: 'Cobertura',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Despachamos a todo Chile a través de <strong>Starken</strong>. Puedes elegir entrega a
                domicilio o retiro en la sucursal Starken más cercana al momento de finalizar tu compra.
              </>
            ),
          },
        ],
      },
      {
        h: 'Plazos de entrega',
        blocks: [
          {
            kind: 'list',
            items: [
              <>
                <strong>Región Metropolitana</strong>: 2 a 4 días hábiles desde la confirmación del
                pago.
              </>,
              <>
                <strong>Regiones</strong>: 3 a 7 días hábiles, según la comuna de destino y la
                cobertura del operador logístico.
              </>,
              <>
                Los plazos se cuentan en días hábiles y comienzan una vez confirmado el pago. No
                incluyen fines de semana ni festivos.
              </>,
            ],
          },
        ],
      },
      {
        h: 'Costos de despacho',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                El costo de despacho se calcula automáticamente en el carrito según la comuna de
                destino y el peso del pedido, y se muestra antes de pagar. No hay cargos ocultos: el
                valor que ves en el resumen de compra es el total final.
              </>
            ),
          },
        ],
      },
      {
        h: 'Preparación del pedido',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Preparamos los pedidos de lunes a viernes. Las compras realizadas después de las 15:00
                hrs o en días no hábiles se procesan el siguiente día hábil.
              </>
            ),
          },
        ],
      },
      {
        h: 'Seguimiento',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Cuando tu pedido es despachado te enviamos un correo con el número de seguimiento de
                Starken para que puedas revisar el estado del envío. También puedes ver el estado de
                tus pedidos en{' '}
                <Link href="/pedidos" className="font-medium text-rust hover:underline">
                  Mi cuenta → Mis pedidos
                </Link>
                .
              </>
            ),
          },
        ],
      },
      {
        h: 'Problemas con la entrega',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Si tu pedido se retrasa más de lo informado, llega dañado o no lo recibes, escríbenos a{' '}
                {mailto} indicando tu número de pedido y te ayudamos a resolverlo. Revisa también
                nuestra{' '}
                <Link href="/legal/devoluciones" className="font-medium text-rust hover:underline">
                  política de cambios y devoluciones
                </Link>
                .
              </>
            ),
          },
        ],
      },
    ],
  },

  terminos: {
    slug: 'terminos',
    label: 'Términos y Condiciones',
    title: 'Términos y Condiciones',
    meta: 'Versión 1.0 — vigente desde el 10 de junio de 2026',
    intro:
      'Las reglas del juego para comprar en Hachiko. Al comprar o crear una cuenta, aceptas estas condiciones.',
    law: null,
    metaTitle: 'Términos y Condiciones — Hachiko',
    metaDescription:
      'Términos y condiciones de uso y compra en Hachiko, incluida la información sobre pago seguro.',
    sections: [
      {
        h: 'Quiénes somos',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Hachiko es una tienda de productos coreanos con operación en Santiago, Chile. Estos
                términos regulan el uso del sitio y la compra de productos a través de él. Al comprar o
                crear una cuenta aceptas estas condiciones.
              </>
            ),
          },
        ],
      },
      {
        h: 'Cuenta de usuario',
        blocks: [
          {
            kind: 'list',
            items: [
              <>
                Eres responsable de mantener la confidencialidad de tu contraseña y de la actividad
                realizada desde tu cuenta.
              </>,
              <>Debes entregar datos verídicos y mantenerlos actualizados.</>,
              <>Podemos suspender cuentas ante uso fraudulento o que infrinja estos términos o la ley.</>,
            ],
          },
        ],
      },
      {
        h: 'Productos, precios y disponibilidad',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Los precios se muestran en pesos chilenos (CLP) e incluyen IVA. Procuramos que la
                información de productos, stock y precios sea exacta; si detectamos un error evidente en
                un precio o en la disponibilidad, podremos anular el pedido afectado y reembolsar lo
                pagado. La compra queda sujeta a disponibilidad de stock.
              </>
            ),
          },
        ],
      },
      {
        h: 'Pago seguro',
        blocks: [
          {
            kind: 'list',
            items: [
              <>
                Los pagos se procesan directamente en <strong>Transbank (Webpay)</strong> o{' '}
                <strong>Mercado Pago</strong>. Toda la comunicación con el sitio viaja cifrada (HTTPS).
              </>,
              <>
                <strong>Hachiko nunca recibe ni almacena el número de tu tarjeta</strong>; solo
                conservamos la referencia de la transacción y su estado.
              </>,
              <>
                El pedido se confirma una vez que el medio de pago aprueba la transacción. Si el pago es
                rechazado, el pedido no se procesa.
              </>,
            ],
          },
        ],
      },
      {
        h: 'Despacho',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Los plazos, costos y cobertura de envío se detallan en la política de{' '}
                <Link href="/legal/despacho" className="font-medium text-rust hover:underline">
                  Envíos a Chile
                </Link>
                .
              </>
            ),
          },
        ],
      },
      {
        h: 'Cambios, devoluciones y garantía',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Tus derechos de retracto, cambio y garantía legal se rigen por la Ley N° 19.496 y se
                detallan en la política de{' '}
                <Link href="/legal/devoluciones" className="font-medium text-rust hover:underline">
                  Cambios y devoluciones
                </Link>
                .
              </>
            ),
          },
        ],
      },
      {
        h: 'Datos personales y propiedad intelectual',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                El tratamiento de tus datos se rige por nuestra{' '}
                <Link href="/legal/privacidad" className="font-medium text-rust hover:underline">
                  Política de Privacidad
                </Link>
                , elaborada conforme a la Ley N° 21.719. Los contenidos del sitio (textos, imágenes,
                logotipos y marcas) están protegidos y no pueden reproducirse sin autorización, salvo el
                uso normal necesario para comprar en la tienda.
              </>
            ),
          },
        ],
      },
      {
        h: 'Responsabilidad, legislación aplicable y contacto',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Nos esforzamos por mantener el sitio disponible y libre de errores, pero no garantizamos
                su funcionamiento ininterrumpido. Nuestra responsabilidad se limita a lo que exige la
                normativa chilena de protección al consumidor. Estos términos se rigen por la ley
                chilena; para cualquier consulta escríbenos a {mailto}.
              </>
            ),
          },
        ],
      },
    ],
  },

  cookies: {
    slug: 'cookies',
    label: 'Cookies',
    title: 'Política de Cookies',
    meta: 'Última actualización: 10 de junio de 2026',
    intro:
      'Usamos solo lo indispensable para que el sitio funcione. Nada de publicidad ni seguimiento de terceros.',
    law: null,
    metaTitle: 'Política de Cookies — Hachiko',
    metaDescription:
      'Qué cookies usa Hachiko. Solo usamos cookies esenciales para la sesión y el carrito.',
    sections: [
      {
        h: 'Qué son las cookies',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Las cookies son pequeños archivos que un sitio guarda en tu navegador para recordar
                información entre páginas y visitas. También usamos tecnologías equivalentes de
                almacenamiento local para el mismo fin.
              </>
            ),
          },
        ],
      },
      {
        h: 'Qué cookies usamos',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                En Hachiko usamos únicamente <strong>cookies esenciales</strong>, necesarias para que
                el sitio funcione:
              </>
            ),
          },
          {
            kind: 'list',
            items: [
              <>
                <strong>Sesión</strong>: mantiene tu sesión iniciada de forma segura mientras navegas.
              </>,
              <>
                <strong>Carrito</strong>: recuerda los productos que agregaste para poder finalizar tu
                compra.
              </>,
            ],
          },
          {
            kind: 'note',
            content: (
              <>
                No usamos cookies de publicidad ni de seguimiento de terceros, ni elaboramos perfiles
                con fines comerciales.
              </>
            ),
          },
        ],
      },
      {
        h: 'Cookies estrictamente necesarias',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Como estas cookies son imprescindibles para prestar el servicio que solicitas (iniciar
                sesión y comprar), no requieren consentimiento previo. Sin ellas el sitio no puede
                funcionar correctamente.
              </>
            ),
          },
        ],
      },
      {
        h: 'Cómo controlarlas',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                Puedes eliminar o bloquear las cookies desde la configuración de tu navegador. Ten en
                cuenta que si bloqueas las cookies esenciales no podrás iniciar sesión ni completar una
                compra.
              </>
            ),
          },
        ],
      },
      {
        h: 'Más información',
        blocks: [
          {
            kind: 'p',
            content: (
              <>
                El tratamiento de datos asociado se describe en nuestra{' '}
                <Link href="/legal/privacidad" className="font-medium text-rust hover:underline">
                  Política de Privacidad
                </Link>
                . Ante cualquier duda, escríbenos a {mailto}.
              </>
            ),
          },
        ],
      },
    ],
  },
};

export function getPolicy(slug: PolicySlug): Policy {
  return POLICIES[slug];
}

export default POLICIES;
