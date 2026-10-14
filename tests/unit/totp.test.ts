import { describe, it, expect } from 'vitest';
import * as OTPAuth from 'otpauth';
import { generateTotpSecret, totpStep, totpUri, verifyTotpCode } from '@/src/lib/auth/totp';

const EMAIL = 'prueba@hachiko.cl';

function currentCode(secretBase32: string): string {
  return new OTPAuth.TOTP({
    issuer: 'Hachiko',
    label: EMAIL,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  }).generate();
}

describe('TOTP (doble factor RFC 6238)', () => {
  it('genera secretos base32 distintos en cada enrolamiento', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Z2-7]+$/);
  });

  it('la URI otpauth incluye emisor y cuenta', () => {
    const secret = generateTotpSecret();
    const uri = totpUri(secret, EMAIL);
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('Hachiko');
    expect(uri).toContain(encodeURIComponent(EMAIL));
  });

  it('acepta el código vigente', () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, EMAIL, currentCode(secret))).toBe(true);
  });

  it('rechaza un código incorrecto', () => {
    const secret = generateTotpSecret();
    const code = currentCode(secret);
    const wrong = code === '000000' ? '000001' : '000000';
    expect(verifyTotpCode(secret, EMAIL, wrong)).toBe(false);
  });

  it('rechaza el código de otro secreto', () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    expect(verifyTotpCode(secretB, EMAIL, currentCode(secretA))).toBe(false);
  });
});

describe('totpStep (anti-replay)', () => {
  it('devuelve el intervalo de 30 s del código vigente', () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    expect(totpStep(secret, EMAIL, currentCode(secret), now)).toBe(Math.floor(now / 30_000));
  });

  it('el código del intervalo anterior se acepta con su propio intervalo (desfase de reloj)', () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const previous = new OTPAuth.TOTP({
      issuer: 'Hachiko', label: EMAIL, algorithm: 'SHA1', digits: 6, period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    }).generate({ timestamp: now - 30_000 });
    expect(totpStep(secret, EMAIL, previous, now)).toBe(Math.floor(now / 30_000) - 1);
  });

  it('null para un código inválido', () => {
    const secret = generateTotpSecret();
    const wrong = currentCode(secret) === '000000' ? '111111' : '000000';
    expect(totpStep(secret, EMAIL, wrong)).toBeNull();
  });
});
