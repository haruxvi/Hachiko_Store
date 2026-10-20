import type { ShippingMethod } from '@prisma/client';
import { shippingLabel, trackingUrlFor } from '@/src/lib/shipping';

// Correos transaccionales vía Resend. Regla de oro: un correo que falla NUNCA
// rompe el flujo que lo dispara (un webhook de pago no puede caerse porque
// Resend esté abajo) — por eso sendEmail captura y solo registra el error.

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  /** Cabeceras extra (p. ej. List-Unsubscribe en los correos de promociones). */
  headers?: Record<string, string>;
}

export async function sendEmail(input: EmailInput): Promise<boolean> {
  const apiKey = process.env['RESEND_API_KEY'];
  const from = process.env['EMAIL_FROM'] ?? 'Hachiko <hola@hachiko.cl>';

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY no configurada; correo omitido: ${input.subject}`);
    return false;
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.headers ? { headers: input.headers } : {}),
    });
    if (error) {
      console.error(`[email] Error de Resend: ${error.message}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[email] Fallo al enviar', e);
    return false;
  }
}

export interface BatchResult {
  sent: number;
  failed: number;
  /** NOT_CONFIGURED: falta RESEND_API_KEY, no se intentó enviar nada. */
  reason?: 'NOT_CONFIGURED';
}

// Resend acepta hasta 100 correos por llamada de lote.
const BATCH_SIZE = 100;

// Envío masivo (promociones). Igual que sendEmail, nunca lanza: informa cuántos
// salieron y cuántos fallaron, para dejarlo registrado en la campaña.
export async function sendEmailBatch(messages: EmailInput[]): Promise<BatchResult> {
  const apiKey = process.env['RESEND_API_KEY'];
  const from = process.env['EMAIL_FROM'] ?? 'Hachiko <hola@hachiko.cl>';

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY no configurada; lote de ${messages.length} correos omitido`);
    return { sent: 0, failed: messages.length, reason: 'NOT_CONFIGURED' };
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const chunk = messages.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await resend.batch.send(
        chunk.map((m) => ({
          from,
          to: m.to,
          subject: m.subject,
          html: m.html,
          ...(m.headers ? { headers: m.headers } : {}),
        })),
      );
      if (error) {
        console.error(`[email] Error de Resend en lote: ${error.message}`);
        failed += chunk.length;
      } else {
        sent += chunk.length;
      }
    } catch (e) {
      console.error('[email] Fallo al enviar lote', e);
      failed += chunk.length;
    }
  }
  return { sent, failed };
}

// ─── Layout común ─────────────────────────────────────────

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#fafafa;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <p style="font-size:20px;font-weight:bold;color:#e11d48;margin:0 0 24px;">Hachiko</p>
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
        <h1 style="font-size:18px;margin:0 0 16px;">${title}</h1>
        ${body}
      </div>
      <p style="font-size:12px;color:#9ca3af;margin-top:20px;">
        Hachiko — productos coreanos · Santiago, Chile · hachiko.store.contacto@gmail.com
      </p>
    </div>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;">
    <a href="${href}" style="background:#e11d48;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:9999px;font-weight:bold;font-size:14px;">${label}</a>
  </p>`;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ─── Plantillas ───────────────────────────────────────────

export function passwordResetEmail(resetUrl: string): { subject: string; html: string } {
  return {
    subject: 'Restablece tu contraseña — Hachiko',
    html: layout(
      'Restablecer contraseña',
      `<p style="font-size:14px;line-height:1.6;">Recibimos una solicitud para restablecer la contraseña de tu cuenta.
        Este enlace es válido por <strong>60 minutos</strong> y solo puede usarse una vez.</p>
       ${button(resetUrl, 'Crear contraseña nueva')}
       <p style="font-size:12px;color:#6b7280;line-height:1.6;">Si no fuiste tú, ignora este correo:
        tu contraseña actual sigue siendo válida y nadie puede cambiarla sin este enlace.</p>`
    ),
  };
}

export function verifyEmailEmail(verifyUrl: string): { subject: string; html: string } {
  return {
    subject: 'Confirma tu correo — Hachiko',
    html: layout(
      'Confirma tu correo',
      `<p style="font-size:14px;line-height:1.6;">¡Bienvenido/a a Hachiko! Confirma tu dirección de correo para que
        podamos enviarte la confirmación de tus compras y el seguimiento de tus envíos.</p>
       ${button(verifyUrl, 'Confirmar mi correo')}
       <p style="font-size:12px;color:#6b7280;">El enlace es válido por 24 horas. Si no creaste esta cuenta, ignora este correo.</p>`
    ),
  };
}

interface OrderEmailItem {
  productName: string;
  quantity: number;
  unitPriceCLP: number;
}

export function orderPaidEmail(input: {
  orderNumber: number;
  items: OrderEmailItem[];
  subtotalCLP: number;
  shippingCLP: number;
  totalCLP: number;
  shippingMethod: ShippingMethod;
  /** true si la compra fue como invitado: se invita a reclamar la cuenta */
  isGuest?: boolean;
}): { subject: string; html: string } {
  const clp = (n: number) => `$${n.toLocaleString('es-CL')}`;
  const rows = input.items
    .map(
      (i) => `<tr>
        <td style="padding:6px 0;font-size:13px;">${i.quantity}× ${esc(i.productName)}</td>
        <td style="padding:6px 0;font-size:13px;text-align:right;">${clp(i.unitPriceCLP * i.quantity)}</td>
      </tr>`
    )
    .join('');

  const entrega =
    input.shippingMethod === 'PICKUP'
      ? 'Retiro en tienda (Recoleta, Santiago) — te avisaremos por correo cuando tu pedido esté listo para retirar.'
      : `Despacho a domicilio vía ${shippingLabel(input.shippingMethod)} — te enviaremos el número de seguimiento cuando despachemos tu pedido.`;

  return {
    subject: `Pago confirmado — pedido #${input.orderNumber}`,
    html: layout(
      `¡Gracias por tu compra! Pedido #${input.orderNumber}`,
      `<p style="font-size:14px;line-height:1.6;">Tu pago fue confirmado y ya estamos preparando tu pedido.</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0;">
         ${rows}
         <tr><td colspan="2" style="border-top:1px solid #e5e7eb;"></td></tr>
         <tr><td style="padding:6px 0;font-size:13px;color:#6b7280;">Subtotal</td><td style="font-size:13px;text-align:right;">${clp(input.subtotalCLP)}</td></tr>
         <tr><td style="padding:6px 0;font-size:13px;color:#6b7280;">Entrega</td><td style="font-size:13px;text-align:right;">${input.shippingCLP === 0 ? 'Gratis' : clp(input.shippingCLP)}</td></tr>
         <tr><td style="padding:6px 0;font-size:14px;font-weight:bold;">Total</td><td style="font-size:14px;font-weight:bold;text-align:right;">${clp(input.totalCLP)}</td></tr>
       </table>
       <p style="font-size:13px;line-height:1.6;color:#374151;">${entrega}</p>
       ${
         input.isGuest
           ? `<p style="font-size:12px;color:#6b7280;line-height:1.6;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:16px;">
                Compraste como invitado. Si quieres revisar el estado de tus pedidos, crea tu
                contraseña con este mismo correo usando la opción <strong>"¿La olvidaste?"</strong>
                al iniciar sesión.</p>`
           : ''
       }`
    ),
  };
}

export function orderShippedEmail(input: {
  orderNumber: number;
  shippingMethod: ShippingMethod;
  trackingNumber: string | null;
  /** Retiro en tienda: hasta cuándo se puede retirar */
  pickupDeadline?: Date;
}): { subject: string; html: string } {
  // Retiro en tienda: el "despacho" significa que está listo para retirar
  if (input.shippingMethod === 'PICKUP') {
    return {
      subject: `Tu pedido #${input.orderNumber} está listo para retiro`,
      html: layout(
        `Pedido #${input.orderNumber} listo para retiro`,
        `<p style="font-size:14px;line-height:1.6;">¡Tu pedido ya está listo! Puedes pasar a retirarlo en nuestra
          tienda de Recoleta, Santiago. Trae tu nombre y este número de pedido.</p>
        ${input.pickupDeadline ? `<p style="font-size:14px;line-height:1.6;">Tienes plazo hasta el <strong>${longDate(input.pickupDeadline)}</strong>. Si no alcanzas a venir, cancelamos el pedido y te devolvemos el dinero completo.</p>` : ''}`
      ),
    };
  }

  const carrier = shippingLabel(input.shippingMethod);
  const url = trackingUrlFor(input.shippingMethod, input.trackingNumber);
  return {
    subject: `Tu pedido #${input.orderNumber} va en camino`,
    html: layout(
      `Pedido #${input.orderNumber} despachado`,
      `<p style="font-size:14px;line-height:1.6;">Tu pedido fue despachado vía <strong>${carrier}</strong>.</p>
       ${
         input.trackingNumber
           ? `<p style="font-size:14px;">Número de seguimiento: <strong>${esc(input.trackingNumber)}</strong></p>
              ${url ? button(url, `Seguir mi envío en ${carrier}`) : ''}`
           : ''
       }`
    ),
  };
}

export function orderRefundedEmail(input: {
  orderNumber: number;
  amountCLP: number;
  viaProvider: boolean;
}): { subject: string; html: string } {
  const amount = `$${input.amountCLP.toLocaleString('es-CL')}`;
  return {
    subject: `Te devolvimos ${amount} del pedido #${input.orderNumber}`,
    html: layout(
      `Reembolso del pedido #${input.orderNumber}`,
      `<p style="font-size:14px;line-height:1.6;">Recibimos tu pago, pero no pudimos completar este pedido
         (se canceló o se agotó un producto mientras pagabas). Ya hicimos la devolución de
         <strong>${amount}</strong>.</p>
       <p style="font-size:14px;line-height:1.6;">${
         input.viaProvider
           ? 'Según tu banco o tarjeta, puede tardar algunos días hábiles en verse reflejada.'
           : 'Si tienes dudas sobre cómo te llegó la devolución, respóndenos este correo.'
       }</p>`
    ),
  };
}

// Se envía a quien intenta registrarse con un correo que YA tiene cuenta. Junto
// con la respuesta genérica del endpoint, evita confirmarle a un tercero si un
// correo está registrado (anti-enumeración), y a la vez avisa al dueño legítimo.
export function accountExistsEmail(loginUrl: string, resetUrl: string): { subject: string; html: string } {
  return {
    subject: 'Ya tienes una cuenta en Hachiko',
    html: layout(
      'Intento de registro con tu correo',
      `<p style="font-size:14px;line-height:1.6;">Alguien intentó crear una cuenta en Hachiko con este correo,
         pero ya tienes una. Si fuiste tú, inicia sesión normalmente.</p>
       ${button(loginUrl, 'Iniciar sesión')}
       <p style="font-size:14px;line-height:1.6;">¿Olvidaste tu contraseña? Puedes
         <a href="${resetUrl}" style="color:#e11d48;">restablecerla aquí</a>.</p>
       <p style="font-size:13px;line-height:1.6;color:#6b7280;">Si no fuiste tú, puedes ignorar este correo:
         no se creó ninguna cuenta nueva ni se cambió nada en la tuya.</p>`
    ),
  };
}

// ─── Retiro en tienda ─────────────────────────────────────

const longDate = (d: Date) =>
  d.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', weekday: 'long', day: 'numeric', month: 'long' });

export function pickupReminderEmail(input: {
  orderNumber: number;
  deadline: Date;
  lastReminder: boolean;
}): { subject: string; html: string } {
  return {
    subject: input.lastReminder
      ? `Último aviso: tu pedido #${input.orderNumber} te espera hasta el ${longDate(input.deadline)}`
      : `Tu pedido #${input.orderNumber} te está esperando`,
    html: layout(
      `Pedido #${input.orderNumber} listo para retiro`,
      `<p style="font-size:14px;line-height:1.6;">Tu pedido sigue esperándote en nuestra tienda de Recoleta, Santiago.
         Puedes pasar a buscarlo hasta el <strong>${longDate(input.deadline)}</strong>. Trae tu nombre y este número de pedido.</p>
       <p style="font-size:14px;line-height:1.6;">Si no alcanzas a retirarlo dentro del plazo, cancelamos el pedido y te
         devolvemos el dinero completo por el mismo medio de pago.</p>`
    ),
  };
}

export function notPickedUpEmail(input: { orderNumber: number }): { subject: string; html: string } {
  return {
    subject: `Cancelamos tu pedido #${input.orderNumber} y te devolveremos el dinero`,
    html: layout(
      `Pedido #${input.orderNumber} no retirado`,
      `<p style="font-size:14px;line-height:1.6;">Venció el plazo para retirar tu pedido en tienda, así que lo cancelamos.
         Te devolveremos el dinero completo por el mismo medio de pago; según tu banco, puede tardar algunos días hábiles
         en verse reflejado.</p>
       <p style="font-size:14px;line-height:1.6;">Si fue un error o todavía lo quieres, respóndenos este correo y lo vemos.</p>`
    ),
  };
}

// ─── Cambios y devoluciones ───────────────────────────────

const RESOLUTION_TEXT = { EXCHANGE: 'cambio del producto', REFUND: 'devolución del dinero', REPAIR: 'reparación' } as const;

export function returnRequestedEmail(input: {
  requestNumber: number;
  orderNumber: number;
  resolution: keyof typeof RESOLUTION_TEXT;
}): { subject: string; html: string } {
  return {
    subject: `Recibimos tu solicitud #${input.requestNumber} (pedido #${input.orderNumber})`,
    html: layout(
      `Solicitud de ${RESOLUTION_TEXT[input.resolution]} recibida`,
      `<p style="font-size:14px;line-height:1.6;">Recibimos tu solicitud de <strong>${RESOLUTION_TEXT[input.resolution]}</strong>
         del pedido #${input.orderNumber}. La revisamos y te escribimos con los pasos a seguir.</p>
       <p style="font-size:14px;line-height:1.6;">Puedes ver el estado en cualquier momento en <strong>Mis pedidos</strong>.</p>`
    ),
  };
}

export function returnUpdateEmail(input: {
  requestNumber: number;
  orderNumber: number;
  status: 'APPROVED' | 'REJECTED' | 'RECEIVED' | 'RESOLVED';
  resolution: keyof typeof RESOLUTION_TEXT;
  note?: string | null;
  refundCLP?: number | null;
}): { subject: string; html: string } {
  const note = input.note ? `<p style="font-size:14px;line-height:1.6;background:#fafafa;border-radius:8px;padding:12px;">${esc(input.note)}</p>` : '';
  const what = RESOLUTION_TEXT[input.resolution];
  const body = {
    APPROVED: `<p style="font-size:14px;line-height:1.6;">Aprobamos tu solicitud de <strong>${what}</strong>. Estos son los pasos para entregarnos el producto:</p>${note}`,
    REJECTED: `<p style="font-size:14px;line-height:1.6;">Revisamos tu solicitud y esta vez no corresponde. Te contamos por qué:</p>${note}
       <p style="font-size:14px;line-height:1.6;">Si no estás de acuerdo, respóndenos este correo. También puedes acudir al SERNAC.</p>`,
    RECEIVED: `<p style="font-size:14px;line-height:1.6;">Recibimos el producto. Ahora gestionamos el <strong>${what}</strong> y te avisamos apenas esté listo.</p>`,
    RESOLVED:
      input.resolution === 'REFUND'
        ? `<p style="font-size:14px;line-height:1.6;">Te devolvimos <strong>$${(input.refundCLP ?? 0).toLocaleString('es-CL')}</strong>
             por el mismo medio de pago. Según tu banco, puede tardar algunos días hábiles en verse reflejado.</p>${note}`
        : `<p style="font-size:14px;line-height:1.6;">Tu <strong>${what}</strong> está listo.</p>${note}`,
  }[input.status];
  const title = {
    APPROVED: 'Solicitud aprobada',
    REJECTED: 'Solicitud no aprobada',
    RECEIVED: 'Recibimos tu producto',
    RESOLVED: 'Solicitud resuelta',
  }[input.status];
  return {
    subject: `${title} · solicitud #${input.requestNumber} (pedido #${input.orderNumber})`,
    html: layout(title, body),
  };
}
