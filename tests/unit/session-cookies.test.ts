import { describe, expect, it } from 'vitest';
import { accessCookieOptions, refreshCookieOptions } from '@/src/lib/auth/session';

describe('cookies de sesión', () => {
  // Regresión: con Strict, al volver de Webpay o Mercado Pago la confirmación no
  // veía la sesión y mostraba "No encontramos una orden pagada" con el pedido pagado.
  it('el access es Lax para viajar en la vuelta desde la pasarela de pago', () => {
    const { options } = accessCookieOptions();
    expect(options.sameSite).toBe('lax');
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe('/');
  });

  it('el refresh sigue Strict y solo viaja a /api/auth', () => {
    const { options } = refreshCookieOptions();
    expect(options.sameSite).toBe('strict');
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe('/api/auth');
  });
});
