import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import * as OTPAuth from 'otpauth';
import { db } from '@/src/lib/db';
import { encrypt } from '@/src/lib/crypto/pii';
import { issueSession, rotateRefreshToken } from '@/src/lib/auth/rotate';
import { signRefreshToken, verifyRefreshToken } from '@/src/lib/auth/jwt';
import { generateTotpSecret } from '@/src/lib/auth/totp';
import { loginUser, registerUser } from '@/src/lib/services/auth.service';
import { createOrder, markOrderDelivered, markOrderPreparing, markOrderShipped } from '@/src/lib/services/order.service';
import { confirmPaymentAndMarkPaid } from '@/src/lib/services/payment.service';
import { recordCheckoutOrder, sweepAbandonedCheckouts } from '@/src/lib/services/analytics.service';
import { PICKUP, makeProduct, makeUser, orderOf, resetDb } from './helpers';

// Segunda tanda de la auditoría: sesiones, login, 2FA, flujo de despacho y
// embudo de conversión, contra Postgres real.

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const PASSWORD = 'Hachiko-Prueba-8';

async function makeLoginUser(extra: Record<string, unknown> = {}) {
  const argon2 = await import('argon2');
  return makeUser({ passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }), ...extra });
}

describe('Refresh tokens: rotación con detección de reutilización', () => {
  it('cada renovación entrega un token nuevo de la misma familia', async () => {
    const user = await makeUser();
    const first = await issueSession(user);
    const r = await rotateRefreshToken(first.refreshToken);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = await verifyRefreshToken(first.refreshToken);
    const b = await verifyRefreshToken(r.refreshToken);
    expect(b.jti).not.toBe(a.jti);
    expect(b.fam).toBe(a.fam);
  });

  it('dos renovaciones simultáneas con el mismo token: una gana, la otra es "carrera" (sin revocar)', async () => {
    const user = await makeUser();
    const { refreshToken } = await issueSession(user);
    const [x, y] = await Promise.all([rotateRefreshToken(refreshToken), rotateRefreshToken(refreshToken)]);
    const results = [x, y];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ ok: false, code: 'REFRESH_RACE' });
    // La familia sigue viva: el token ganador renueva normalmente
    const winner = results.find((r) => r.ok);
    if (winner?.ok) expect((await rotateRefreshToken(winner.refreshToken)).ok).toBe(true);
  });

  it('token ya usado que reaparece después: se revoca TODA la familia y se audita', async () => {
    const user = await makeUser();
    const stolen = (await issueSession(user)).refreshToken;
    const legit = await rotateRefreshToken(stolen);
    expect(legit.ok).toBe(true);
    // Fuera de la ventana de carrera (30 s)
    const { jti } = await verifyRefreshToken(stolen);
    await db.refreshToken.update({ where: { id: jti! }, data: { usedAt: new Date(Date.now() - 60_000) } });

    expect(await rotateRefreshToken(stolen)).toEqual({ ok: false, code: 'INVALID_REFRESH' });
    // El token "nuevo" de esa familia también quedó inservible
    if (legit.ok) expect(await rotateRefreshToken(legit.refreshToken)).toEqual({ ok: false, code: 'INVALID_REFRESH' });
    expect(await db.auditLog.count({ where: { action: 'REFRESH_TOKEN_REUSE', actorId: user.id } })).toBe(1);
  });

  it('revocar una familia no cierra las otras sesiones (otro dispositivo)', async () => {
    const user = await makeUser();
    const phone = await issueSession(user);
    const laptop = await issueSession(user);
    const used = await rotateRefreshToken(phone.refreshToken);
    expect(used.ok).toBe(true);
    const { jti } = await verifyRefreshToken(phone.refreshToken);
    await db.refreshToken.update({ where: { id: jti! }, data: { usedAt: new Date(Date.now() - 60_000) } });
    await rotateRefreshToken(phone.refreshToken); // reutilización → revoca la familia del teléfono

    expect((await rotateRefreshToken(laptop.refreshToken)).ok).toBe(true);
  });

  it('token emitido antes del registro (sin jti): se acepta una vez y pasa a una familia registrada', async () => {
    const user = await makeUser();
    const legacy = await signRefreshToken({ sub: user.id, role: user.role, email: user.email }, user.tokenVersion, '', '');
    const r = await rotateRefreshToken(legacy);
    expect(r.ok).toBe(true);
    if (r.ok) expect((await verifyRefreshToken(r.refreshToken)).jti).toBeTruthy();
  });

  it('cerrar sesión (tokenVersion) invalida los refresh tokens emitidos antes', async () => {
    const user = await makeUser();
    const { refreshToken } = await issueSession(user);
    await db.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });
    expect(await rotateRefreshToken(refreshToken)).toEqual({ ok: false, code: 'INVALID_REFRESH' });
  });
});

describe('Login: bloqueo por intentos y 2FA', () => {
  it('10 contraseñas erradas en paralelo cuentan como 10 y bloquean una sola vez', async () => {
    const user = await makeLoginUser();
    await Promise.all(
      Array.from({ length: 10 }, () => loginUser({ email: user.email, password: 'incorrecta' })),
    );
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.failedLogins).toBe(10);
    expect(after.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(await db.auditLog.count({ where: { action: 'ACCOUNT_LOCKED', actorId: user.id } })).toBe(1);
  });

  it('un código 2FA no se puede usar dos veces', async () => {
    const secret = generateTotpSecret();
    const user = await makeLoginUser({ totpSecret: encrypt(secret), totpEnabledAt: new Date() });
    const code = new OTPAuth.TOTP({
      issuer: 'Hachiko', label: user.email, algorithm: 'SHA1', digits: 6, period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    }).generate();

    const first = await loginUser({ email: user.email, password: PASSWORD, totpCode: code });
    expect(first.ok).toBe(true);
    const replay = await loginUser({ email: user.email, password: PASSWORD, totpCode: code });
    expect(replay).toMatchObject({ ok: false, error: { code: 'INVALID_TOTP' } });
  });

  it('el login exitoso registra un refresh token en la base', async () => {
    const user = await makeLoginUser();
    const r = await loginUser({ email: user.email, password: PASSWORD });
    expect(r.ok).toBe(true);
    expect(await db.refreshToken.count({ where: { userId: user.id } })).toBe(1);
  });
});

describe('Flujo de despacho: preparando → enviado → entregado', () => {
  async function paidOrder() {
    const product = await makeProduct(5);
    const user = await makeUser();
    const order = await createOrder(user.id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);
    await confirmPaymentAndMarkPaid(order.id, 'WEBPAY', 'tok', order.totalCLP);
    return order;
  }

  it('recorre todos los estados y deja la línea de tiempo completa', async () => {
    const order = await paidOrder();
    const seller = await makeUser({ role: 'SELLER' });

    await markOrderPreparing(order.id, seller.id);
    await markOrderShipped(order.id, null, seller.id, 'SELLER');
    await markOrderDelivered(order.id, seller.id);

    const o = await orderOf(order.id);
    expect(o.status).toBe('DELIVERED');
    expect(o.deliveredAt).not.toBeNull();
    const history = await db.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } });
    expect(history.map((h) => h.toStatus)).toEqual(['PENDING', 'PAID', 'PREPARING', 'SHIPPED', 'DELIVERED']);
  });

  it('no se puede entregar algo que no se envió, ni preparar algo ya enviado', async () => {
    const order = await paidOrder();
    const seller = await makeUser({ role: 'SELLER' });

    await expect(markOrderDelivered(order.id, seller.id)).rejects.toThrow(/enviado/);
    await markOrderShipped(order.id, 'ST123', seller.id, 'SELLER');
    await expect(markOrderPreparing(order.id, seller.id)).rejects.toThrow(/preparación/);
  });

  it('doble clic en "entregado": solo se registra una vez', async () => {
    const order = await paidOrder();
    const seller = await makeUser({ role: 'SELLER' });
    await markOrderShipped(order.id, null, seller.id, 'SELLER');

    const results = await Promise.allSettled([markOrderDelivered(order.id, seller.id), markOrderDelivered(order.id, seller.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.orderStatusHistory.count({ where: { orderId: order.id, toStatus: 'DELIVERED' } })).toBe(1);
  });
});

describe('Embudo: checkouts abandonados', () => {
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

  async function checkoutStart(sessionId: string, at: Date, userId: string | null = null) {
    await db.analyticsEvent.create({ data: { sessionId, userId, type: 'CHECKOUT_START', path: '/checkout', createdAt: at } });
  }

  it('marca como abandonado solo el checkout sin pago de hace más de 2 h, una sola vez', async () => {
    const abandoned = randomUUID();
    const recent = randomUUID();
    const bought = randomUUID();
    await checkoutStart(abandoned, hoursAgo(3));
    await checkoutStart(recent, hoursAgo(1));
    await checkoutStart(bought, hoursAgo(3));

    // La sesión "bought" terminó en un pedido pagado
    const product = await makeProduct(5);
    const user = await makeUser({ consentMarketing: true });
    const order = await createOrder(user.id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);
    await recordCheckoutOrder(bought, user.id, order.id);
    await db.analyticsEvent.updateMany({ where: { sessionId: bought }, data: { createdAt: hoursAgo(3) } });
    await confirmPaymentAndMarkPaid(order.id, 'WEBPAY', 'tok', order.totalCLP);

    expect(await sweepAbandonedCheckouts()).toBe(1);
    const abandons = await db.analyticsEvent.findMany({ where: { type: 'CHECKOUT_ABANDON' } });
    expect(abandons.map((a) => a.sessionId)).toEqual([abandoned]);

    // Idempotente: correrlo otra vez no duplica
    expect(await sweepAbandonedCheckouts()).toBe(0);
  });

  it('el pedido solo queda asociado a la cuenta si hay consentimiento comercial', async () => {
    const product = await makeProduct(5);
    const noConsent = await makeUser({ consentMarketing: false });
    const order = await createOrder(noConsent.id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);
    const session = randomUUID();
    await recordCheckoutOrder(session, noConsent.id, order.id);
    const ev = await db.analyticsEvent.findFirstOrThrow({ where: { sessionId: session } });
    expect(ev.userId).toBeNull();
  });
});

describe('Registro anti-enumeración (Ley 21.719 / no revelar existencia)', () => {
  it('correo nuevo: crea la cuenta y NO inicia sesión (sin tokens)', async () => {
    const email = `nuevo${Date.now()}@test.local`;
    const r = await registerUser(
      { email, password: 'Hachiko-Prueba-8', firstName: 'A', lastName: 'B', consentEssential: true, consentMarketing: false, consentVersion: 'v1.0-2026' },
    );
    expect(r).toEqual({ created: true }); // sin accessToken/refreshToken: no auto-login
    expect(await db.user.count({ where: { email } })).toBe(1);
  });

  it('correo existente: responde created:false, NO lanza y audita el intento (sin crear otra cuenta)', async () => {
    const email = `existe${Date.now()}@test.local`;
    const base = { password: 'Hachiko-Prueba-8', firstName: 'A', lastName: 'B', consentEssential: true as const, consentMarketing: false, consentVersion: 'v1.0-2026' };
    await registerUser({ email, ...base });
    const r = await registerUser({ email, ...base });
    expect(r).toEqual({ created: false });
    expect(await db.user.count({ where: { email } })).toBe(1); // no se duplicó
    expect(await db.auditLog.count({ where: { action: 'REGISTER_EXISTING_EMAIL' } })).toBeGreaterThanOrEqual(1);
  });
});
