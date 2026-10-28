// Plantillas HTML de los correos de promociones, con la paleta Shiba de la tienda.
// Sin dependencias de servidor: la vista previa del panel usa exactamente esta
// misma función, así lo que ve el vendedor es lo que reciben los clientes.
//
// Todo texto escrito por el vendedor (y los nombres de producto) se escapa:
// nadie puede inyectar HTML ni scripts en un correo que llega a los clientes.

export const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const C = {
  cream: '#FEF7E4',
  butter: '#FBE7A0',
  snow: '#FFFFFF',
  sand: '#F0E2C6',
  soot: '#3D2F25',
  taupe: '#A8907A',
  rust: '#EC9C4A',
};
const FONT = "Arial,Helvetica,sans-serif";
const CONTACT = 'hachiko.store.contacto@gmail.com';

export interface PromoProduct {
  name: string;
  priceCLP: number;
  url: string;
  image?: string | null;
}

/** Une una ruta interna ya validada ("/catalogo?x=y") con la URL pública del sitio. */
export function absoluteUrl(appUrl: string, path: string): string {
  return new URL(path, appUrl).href;
}

// Solo imágenes https: una http:// se ve rota en Gmail y filtra la IP del lector.
function safeImage(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

function paragraphs(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.soot};">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`,
    )
    .join('');
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;"><tr><td style="background:${C.rust};border-radius:12px;">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:bold;color:${C.snow};text-decoration:none;">${escapeHtml(label)}</a>
  </td></tr></table>`;
}

function shell(opts: { preheader: string; title: string; content: string; footer: string }): string {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${C.cream};font-family:${FONT};color:${C.soot};">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="background:${C.butter};border-radius:16px 16px 0 0;padding:18px 26px;">
          <span style="font-size:22px;font-weight:bold;color:${C.soot};letter-spacing:-0.5px;">hachiko</span>
          <span style="font-size:13px;color:${C.taupe};padding-left:6px;">하치코</span>
        </td></tr>
        <tr><td style="background:${C.snow};border:1px solid ${C.sand};border-top:0;border-radius:0 0 16px 16px;padding:28px 26px;">
          <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:${C.soot};">${escapeHtml(opts.title)}</h1>
          ${opts.content}
        </td></tr>
        <tr><td style="padding:18px 8px;font-size:12px;line-height:1.6;color:${C.taupe};text-align:center;">
          ${opts.footer}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function productGrid(products: PromoProduct[]): string {
  if (products.length === 0) return '';
  const cell = (p: PromoProduct) => {
    const img = safeImage(p.image);
    return `<td width="50%" valign="top" style="padding:6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.sand};border-radius:12px;background:${C.cream};">
        <tr><td style="padding:12px;text-align:center;">
          ${
            img
              ? `<a href="${escapeHtml(p.url)}"><img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" width="140" style="display:block;margin:0 auto 10px;width:140px;max-width:100%;height:auto;border-radius:8px;"></a>`
              : ''
          }
          <a href="${escapeHtml(p.url)}" style="font-size:14px;font-weight:bold;color:${C.soot};text-decoration:none;">${escapeHtml(p.name)}</a>
          <div style="margin-top:4px;font-size:14px;color:${C.taupe};">$${p.priceCLP.toLocaleString('es-CL')}</div>
        </td></tr>
      </table>
    </td>`;
  };
  const rows: string[] = [];
  for (let i = 0; i < products.length; i += 2) {
    const pair = products.slice(i, i + 2);
    rows.push(`<tr>${pair.map(cell).join('')}${pair.length === 1 ? '<td width="50%"></td>' : ''}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 4px;">${rows.join('')}</table>`;
}

export function promoEmail(input: {
  title: string;
  body: string;
  cta?: { label: string; url: string } | null;
  products: PromoProduct[];
  unsubscribeUrl: string;
}): string {
  const preheader = input.body.trim().split('\n')[0]?.slice(0, 120) ?? '';
  return shell({
    preheader,
    title: input.title,
    content: `${paragraphs(input.body)}${productGrid(input.products)}${input.cta ? button(input.cta.url, input.cta.label) : ''}`,
    footer: `Recibes este correo porque aceptaste recibir promociones de Hachiko.<br>
      <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:${C.taupe};text-decoration:underline;">Darme de baja</a>
      · Hachiko — productos coreanos · Santiago, Chile · ${CONTACT}`,
  });
}

export function newsletterConfirmEmail(confirmUrl: string): { subject: string; html: string } {
  return {
    subject: 'Confirma tu suscripción — Hachiko',
    html: shell({
      preheader: 'Falta un paso para recibir nuestras promociones.',
      title: 'Confirma tu suscripción',
      content: `${paragraphs(
        'Alguien (esperamos que tú) pidió recibir las promociones de Hachiko en este correo.\n\nPara activarla, confirma con el botón. El enlace vence en 7 días.',
      )}${button(confirmUrl, 'Confirmar suscripción')}
      <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${C.taupe};">Si no fuiste tú, ignora este correo: no te enviaremos nada más.</p>`,
      footer: `Hachiko — productos coreanos · Santiago, Chile · ${CONTACT}`,
    }),
  };
}
