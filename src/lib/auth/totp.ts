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
  const delta = buildTotp(secretBase32, accountEmail).validate({ token: code, window: 1 });
  return delta !== null;
}
