import { createHmac, timingSafeEqual } from 'crypto';

// Enlaces de los correos de promociones: confirmar la suscripción y darse de baja.
//
// Van firmados con HMAC-SHA256, con una clave derivada de JWT_SECRET y una
// etiqueta propia, así:
//  - nadie puede fabricar el enlace de otra persona (ni para suscribirla ni para
//    darla de baja), porque no conoce la clave del servidor;
//  - no hace falta guardar tokens en la base de datos;
//  - llevan un id opaco y nunca el correo, porque las URLs quedan en logs del
//    servidor y en el historial del navegador.

export type NewsletterTokenKind = 'confirm' | 'unsub';
/** `sub` = NewsletterSubscriber (suscrito desde el footer), `user` = cuenta registrada. */
export type NewsletterSubject = 'sub' | 'user';

const MAX_TOKEN_LENGTH = 512;

function key(): Buffer {
  const secret = process.env['JWT_SECRET'];
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }
  // Clave distinta de la de sesión: un token de correo nunca sirve como token de
  // sesión ni viceversa.
  return createHmac('sha256', secret).update('hachiko:newsletter:v1').digest();
}

function sign(payload: string): Buffer {
  return createHmac('sha256', key()).update(payload).digest();
}

/** `ttlMs` opcional: sin él, el enlace no vence (lo usan los de baja). */
export function signNewsletterToken(
  kind: NewsletterTokenKind,
  subject: NewsletterSubject,
  id: string,
  ttlMs?: number,
): string {
  const exp = ttlMs ? Math.floor((Date.now() + ttlMs) / 1000) : 0;
  const payload = `${kind}.${subject}.${id}.${exp}`;
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload).toString('base64url')}`;
}

export function verifyNewsletterToken(
  token: unknown,
  kind: NewsletterTokenKind,
): { subject: NewsletterSubject; id: string } | null {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts as [string, string];

  const payload = Buffer.from(encoded, 'base64url').toString('utf8');
  const expected = sign(payload);
  const given = Buffer.from(signature, 'base64url');
  // Comparación en tiempo constante: no revela cuántos bytes coinciden.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const [tokenKind, subject, id, exp] = payload.split('.');
  if (tokenKind !== kind || (subject !== 'sub' && subject !== 'user') || !id) return null;
  const expSeconds = Number(exp);
  if (!Number.isFinite(expSeconds) || (expSeconds > 0 && expSeconds * 1000 < Date.now())) return null;

  return { subject, id };
}
