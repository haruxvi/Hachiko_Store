import * as OTPAuth from 'otpauth';

// TOTP estándar (RFC 6238): compatible con Google Authenticator, Authy,
// Microsoft Authenticator y cualquier app de códigos. Sin servicios externos.

const ISSUER = 'Hachiko';
const PERIOD_SECONDS = 30;
const DIGITS = 6;

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

function buildTotp(secretBase32: string, accountEmail: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountEmail,
    algorithm: 'SHA1',
    digits: DIGITS,
    period: PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function totpUri(secretBase32: string, accountEmail: string): string {
  return buildTotp(secretBase32, accountEmail).toString();
}

// window 1: acepta el código del intervalo anterior/siguiente para tolerar
// desfase de reloj del teléfono (~30 s)
export function verifyTotpCode(
  secretBase32: string,
  accountEmail: string,
  code: string
): boolean {
  return totpStep(secretBase32, accountEmail, code) !== null;
}

/**
 * Intervalo TOTP (contador de 30 s) al que corresponde el código, o null si no
 * es válido. Guardar el último intervalo usado permite rechazar el mismo código
 * si alguien lo reutiliza dentro de su ventana (lo vio por encima del hombro,
 * lo capturó un phishing en tiempo real, etc.).
 */
export function totpStep(
  secretBase32: string,
  accountEmail: string,
  code: string,
  now = Date.now(),
): number | null {
  const delta = buildTotp(secretBase32, accountEmail).validate({ token: code, window: 1, timestamp: now });
  if (delta === null) return null;
  return Math.floor(now / 1000 / PERIOD_SECONDS) + delta;
}
