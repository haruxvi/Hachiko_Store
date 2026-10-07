import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { signNewsletterToken, verifyNewsletterToken } from '@/src/lib/newsletter/tokens';
import { PromoInputSchema, SubscribeSchema, isDeliverableEmail } from '@/src/lib/newsletter/validation';
import { promoEmail, newsletterConfirmEmail, absoluteUrl, escapeHtml } from '@/src/lib/newsletter/templates';

beforeAll(() => {
  process.env['JWT_SECRET'] = 'test-secret-de-al-menos-32-caracteres-123456';
});
afterEach(() => vi.useRealTimers());

// ─── Enlaces firmados (confirmar / darse de baja) ───────────────────────────

describe('tokens de newsletter', () => {
  it('un token válido se verifica y devuelve a quién corresponde', () => {
    const t = signNewsletterToken('unsub', 'user', 'cuid123');
    expect(verifyNewsletterToken(t, 'unsub')).toEqual({ subject: 'user', id: 'cuid123' });
  });

  it('no lleva el correo en el enlace', () => {
    const t = signNewsletterToken('unsub', 'sub', 'abc');
    expect(Buffer.from(t.split('.')[0]!, 'base64url').toString()).not.toContain('@');
  });

  it('rechaza un token alterado (otro id con la firma original)', () => {
    const t = signNewsletterToken('unsub', 'user', 'victima');
    const [, sig] = t.split('.');
    const forged = `${Buffer.from('unsub.user.otra-persona.0').toString('base64url')}.${sig}`;
    expect(verifyNewsletterToken(forged, 'unsub')).toBeNull();
  });

  it('un token de baja no sirve para confirmar ni viceversa', () => {
    expect(verifyNewsletterToken(signNewsletterToken('unsub', 'sub', 'x'), 'confirm')).toBeNull();
    expect(verifyNewsletterToken(signNewsletterToken('confirm', 'sub', 'x', 60_000), 'unsub')).toBeNull();
  });

  it('el enlace de confirmación vence', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
    const t = signNewsletterToken('confirm', 'sub', 'x', 7 * 24 * 3600 * 1000);
    vi.setSystemTime(new Date('2026-10-07T00:00:00Z'));
    expect(verifyNewsletterToken(t, 'confirm')).not.toBeNull();
    vi.setSystemTime(new Date('2026-10-09T00:00:00Z'));
    expect(verifyNewsletterToken(t, 'confirm')).toBeNull();
  });

  it('una firma hecha con otra clave no es válida', () => {
    const t = signNewsletterToken('unsub', 'user', 'x');
    process.env['JWT_SECRET'] = 'otra-clave-distinta-de-al-menos-32-caracteres';
    expect(verifyNewsletterToken(t, 'unsub')).toBeNull();
    process.env['JWT_SECRET'] = 'test-secret-de-al-menos-32-caracteres-123456';
  });

  it.each([undefined, '', 'basura', 'a.b.c', 'x'.repeat(600)])('rechaza entradas inválidas: %s', (bad) => {
    expect(verifyNewsletterToken(bad, 'unsub')).toBeNull();
  });
});

// ─── Validación ─────────────────────────────────────────────────────────────

const base = { subject: 'Promo de octubre', title: 'Llegaron los Pepero', body: 'Hasta agotar stock en tienda.' };

describe('validación de promociones', () => {
  it('acepta una promoción normal con botón a una categoría', () => {
    expect(PromoInputSchema.safeParse({ ...base, ctaLabel: 'Ver snacks', ctaPath: '/catalogo?categoria=snacks' }).success).toBe(true);
  });

  it.each(['https://sitio-falso.com', '//sitio-falso.com', 'javascript:alert(1)', 'catalogo', '/ruta con espacio'])(
    'el botón no puede apuntar fuera de la tienda: %s',
    (ctaPath) => {
      expect(PromoInputSchema.safeParse({ ...base, ctaLabel: 'Ver', ctaPath }).success).toBe(false);
    },
  );

  it('el asunto no admite saltos de línea (inyección de cabeceras)', () => {
    expect(PromoInputSchema.safeParse({ ...base, subject: 'Hola\r\nBcc: todos@x.cl' }).success).toBe(false);
  });

  it('máximo 4 productos destacados', () => {
    expect(PromoInputSchema.safeParse({ ...base, productIds: ['a', 'b', 'c', 'd', 'e'] }).success).toBe(false);
  });

  it('normaliza el correo de suscripción', () => {
    expect(SubscribeSchema.parse({ email: '  Ana@Correo.CL ' }).email).toBe('ana@correo.cl');
  });

  it.each([
    ['cliente1@seed.hachiko.test', false],
    ['vendedor@hachiko.local', false],
    ['x@example.com', false],
    ['ana@gmail.com', true],
  ])('%s se puede enviar: %s', (email, expected) => {
    expect(isDeliverableEmail(email)).toBe(expected);
  });
});

// ─── Plantillas ─────────────────────────────────────────────────────────────

describe('plantillas de correo', () => {
  const html = promoEmail({
    title: '<script>alert("t")</script>Oferta',
    body: 'Primera línea <img src=x onerror=alert(1)>\n\nSegundo párrafo',
    cta: { label: 'Ver "todo"', url: absoluteUrl('https://hachiko-store.vercel.app', '/catalogo') },
    products: [
      { name: 'Pepero <b>', priceCLP: 1990, url: 'https://hachiko-store.vercel.app/producto/x', image: 'https://img.test/a.png' },
      { name: 'Ramen', priceCLP: 1490, url: 'https://hachiko-store.vercel.app/producto/y', image: 'http://inseguro.test/b.png' },
    ],
    unsubscribeUrl: 'https://hachiko-store.vercel.app/newsletter/baja?token=abc',
  });

  it('escapa todo lo que escribe el vendedor (sin HTML ni scripts inyectados)', () => {
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain(escapeHtml('<script>alert("t")</script>Oferta'));
    expect(html).toContain('Pepero &lt;b&gt;');
  });

  it('separa los párrafos del mensaje', () => {
    expect(html.match(/Segundo párrafo/g)).toHaveLength(1);
    expect(html).toMatch(/<p[^>]*>Primera línea/);
  });

  it('solo muestra imágenes https', () => {
    expect(html).toContain('https://img.test/a.png');
    expect(html).not.toContain('http://inseguro.test');
  });

  it('incluye el enlace de baja', () => {
    expect(html).toContain('/newsletter/baja?token=abc');
    expect(html).toContain('Darme de baja');
  });

  it('el correo de confirmación lleva el enlace y dice qué hacer si no fue uno', () => {
    const mail = newsletterConfirmEmail('https://hachiko-store.vercel.app/newsletter/confirmar?token=t');
    expect(mail.html).toContain('/newsletter/confirmar?token=t');
    expect(mail.html).toContain('Si no fuiste tú');
  });

  it('arma URLs absolutas a partir de rutas internas', () => {
    expect(absoluteUrl('https://hachiko-store.vercel.app', '/catalogo?categoria=snacks')).toBe(
      'https://hachiko-store.vercel.app/catalogo?categoria=snacks',
    );
  });
});
