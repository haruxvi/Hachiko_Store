import type { ShippingMethod } from '@prisma/client';
import { shippingLabel, trackingUrlFor } from '@/src/lib/shipping';

// Correos transaccionales vía Resend. Regla de oro: un correo que falla NUNCA
// rompe el flujo que lo dispara (un webhook de pago no puede caerse porque
// Resend esté abajo) — por eso sendEmail captura y solo registra el error.

interface EmailInput {
  to: string;
  subject: string;
  html: string;
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
        Hachiko — productos coreanos · Santiago, Chile · contacto@hachiko.cl
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
}): { subject: string; html: string } {
  // Retiro en tienda: el "despacho" significa que está listo para retirar
  if (input.shippingMethod === 'PICKUP') {
    return {
      subject: `Tu pedido #${input.orderNumber} está listo para retiro`,
      html: layout(
        `Pedido #${input.orderNumber} listo para retiro`,
        `<p style="font-size:14px;line-height:1.6;">¡Tu pedido ya está listo! Puedes pasar a retirarlo en nuestra
          tienda de Recoleta, Santiago. Trae tu nombre y este número de pedido.</p>`
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
