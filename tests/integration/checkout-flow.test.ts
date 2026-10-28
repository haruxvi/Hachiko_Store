import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '@/src/lib/db';
import { createOrder, cancelOrder } from '@/src/lib/services/order.service';
import { confirmPaymentAndMarkPaid, markPaymentFailed } from '@/src/lib/services/payment.service';
import { executeDueDeletions, requestAccountDeletion } from '@/src/lib/services/customer.service';
import { PICKUP, makeProduct, makeUser, orderOf, resetDb, stockOf } from './helpers';

// Flujo completo pedido → pago → stock contra Postgres real, con transacciones
// Serializable de verdad. Cada caso reproduce un problema concreto de la
// auditoría del 14-10-2026 y comprueba que ya no ocurre.

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe('Concurrencia de compras (sin sobreventa)', () => {
  it('cinco compras simultáneas de la última unidad: exactamente una reserva', async () => {
    const product = await makeProduct(1);
    const users = await Promise.all([1, 2, 3, 4, 5].map(() => makeUser()));

    const results = await Promise.allSettled(
      users.map((u) => createOrder(u.id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP)),
    );

    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(4);
    for (const f of failed) expect(String(f.reason?.message)).toMatch(/Stock insuficiente/);

    const reserved = await db.stockReservation.aggregate({ where: { productId: product.id }, _sum: { quantity: true } });
    expect(reserved._sum.quantity).toBe(1);
  });

  it('cinco pagos simultáneos sobre stock 2 (reservas vencidas): nunca stock negativo', async () => {
    const product = await makeProduct(2);
    const orders = [];
    // Se crean de a una y se vence su reserva enseguida: así hay 5 pedidos
    // pendientes (pagos tardíos) compitiendo por las mismas 2 unidades.
    for (let i = 0; i < 5; i++) {
      const u = await makeUser();
      orders.push(await createOrder(u.id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP));
      await db.stockReservation.updateMany({ data: { expiresAt: new Date(Date.now() - 60_000) } });
    }

    const outcomes = await Promise.all(
      orders.map((o, i) => confirmPaymentAndMarkPaid(o.id, 'WEBPAY', `tok-${i}`, o.totalCLP)),
    );

    expect(outcomes.filter((o) => o === 'paid')).toHaveLength(2);
    expect(outcomes.filter((o) => o === 'refund_pending')).toHaveLength(3);
    expect(await stockOf(product.id)).toBe(0);
  });
});

describe('Confirmación de pago atómica', () => {
  it('pago normal: descuenta stock, registra movimiento negativo e historial', async () => {
    const product = await makeProduct(5);
    const user = await makeUser();
    const order = await createOrder(user.id, [{ productId: product.id, quantity: 2 }], 'PICKUP', PICKUP);

    expect(await confirmPaymentAndMarkPaid(order.id, 'WEBPAY', 'tok', order.totalCLP)).toBe('paid');

    expect(await stockOf(product.id)).toBe(3);
    const o = await orderOf(order.id);
    expect(o.status).toBe('PAID');
    expect(o.paymentStatus).toBe('PAID');
    const movements = await db.stockMovement.findMany({ where: { orderId: order.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]!.quantity).toBe(-2);
    expect(await db.stockReservation.count({ where: { orderId: order.id } })).toBe(0);
    const history = await db.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } });
    expect(history.map((h) => h.toStatus)).toEqual(['PENDING', 'PAID']);
  });

  it('webhook repetido: no descuenta dos veces (idempotencia)', async () => {
    const product = await makeProduct(5);
    const user = await makeUser();
    const order = await createOrder(user.id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);

    const both = await Promise.all([
      confirmPaymentAndMarkPaid(order.id, 'MERCADOPAGO', 'pay-1', order.totalCLP),
      confirmPaymentAndMarkPaid(order.id, 'MERCADOPAGO', 'pay-1', order.totalCLP),
    ]);
    expect(both.sort()).toEqual(['already_paid', 'paid']);
    expect(await stockOf(product.id)).toBe(4);
    expect(await db.stockMovement.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('pago tardío con la reserva ya limpiada por el cron: igual se descuenta si hay stock', async () => {
    const product = await makeProduct(3);
    const user = await makeUser();
    const order = await createOrder(user.id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);
    await db.stockReservation.deleteMany({ where: { orderId: order.id } }); // lo que hace el cron

    // Antes: la orden quedaba PAID sin descontar stock (lanzaba "No hay reservas").
    expect(await confirmPaymentAndMarkPaid(order.id, 'MERCADOPAGO', 'pay', order.totalCLP)).toBe('paid');
    expect(await stockOf(product.id)).toBe(2);
  });

  it('pago tardío cuando la última unidad ya se vendió: reembolso, nunca stock negativo', async () => {
    const product = await makeProduct(1);
    const late = await createOrder((await makeUser()).id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);
    await db.stockReservation.updateMany({ where: { orderId: late.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const winner = await createOrder((await makeUser()).id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);
    expect(await confirmPaymentAndMarkPaid(winner.id, 'WEBPAY', 'w', winner.totalCLP)).toBe('paid');

    expect(await confirmPaymentAndMarkPaid(late.id, 'MERCADOPAGO', 'late', late.totalCLP)).toBe('refund_pending');
    expect(await stockOf(product.id)).toBe(0);
    const o = await orderOf(late.id);
    expect(o.status).toBe('CANCELLED');
    expect(o.paymentStatus).toBe('REFUND_PENDING');
    expect(await db.auditLog.count({ where: { action: 'PAYMENT_REQUIRES_REFUND', targetId: late.id } })).toBe(1);
  });

  it('monto distinto al total: reembolso y stock intacto', async () => {
    const product = await makeProduct(5);
    const order = await createOrder((await makeUser()).id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);

    expect(await confirmPaymentAndMarkPaid(order.id, 'WEBPAY', 'tok', order.totalCLP - 1)).toBe('refund_pending');
    expect(await stockOf(product.id)).toBe(5);
    expect((await orderOf(order.id)).paymentStatus).toBe('REFUND_PENDING');
  });

  it('fail-closed: sin monto (undefined) o monto <=0 NO se confirma a ciegas', async () => {
    const p1 = await makeProduct(5);
    const o1 = await createOrder((await makeUser()).id, [{ productId: p1.id, quantity: 1 }], 'PICKUP', PICKUP);
    // La pasarela no devolvió monto: no se puede verificar → reembolso, stock intacto
    expect(await confirmPaymentAndMarkPaid(o1.id, 'WEBPAY', 'tok', undefined)).toBe('refund_pending');
    expect(await stockOf(p1.id)).toBe(5);
    expect((await orderOf(o1.id)).status).toBe('CANCELLED');

    const p2 = await makeProduct(5);
    const o2 = await createOrder((await makeUser()).id, [{ productId: p2.id, quantity: 1 }], 'PICKUP', PICKUP);
    expect(await confirmPaymentAndMarkPaid(o2.id, 'MERCADOPAGO', 'pay', 0)).toBe('refund_pending');
    expect(await stockOf(p2.id)).toBe(5);
  });

  it('pago rechazado y luego aprobado (reintento en MercadoPago): queda pagado', async () => {
    const product = await makeProduct(5);
    const order = await createOrder((await makeUser()).id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);

    await markPaymentFailed(order.id, 'MERCADOPAGO');
    expect((await orderOf(order.id)).paymentStatus).toBe('FAILED');

    expect(await confirmPaymentAndMarkPaid(order.id, 'MERCADOPAGO', 'retry', order.totalCLP)).toBe('paid');
    expect(await stockOf(product.id)).toBe(4);
  });

  it('referencia de pago que no corresponde a ninguna orden: no lanza (el webhook no reintenta sin fin)', async () => {
    expect(await confirmPaymentAndMarkPaid('no-existe', 'MERCADOPAGO', 'x', 100)).toBe('not_found');
  });
});

describe('Cancelación', () => {
  it('pago que llega después de cancelar: NO revive el pedido, queda para reembolso', async () => {
    const product = await makeProduct(5);
    const user = await makeUser();
    const order = await createOrder(user.id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);

    await cancelOrder(order.id, user.id);
    expect(await confirmPaymentAndMarkPaid(order.id, 'MERCADOPAGO', 'pay', order.totalCLP)).toBe('refund_pending');

    const o = await orderOf(order.id);
    expect(o.status).toBe('CANCELLED');
    expect(o.paymentStatus).toBe('REFUND_PENDING');
    expect(await stockOf(product.id)).toBe(5);
  });

  it('cancelar y pagar al mismo tiempo: nunca queda "pagado y cancelado"', async () => {
    for (let i = 0; i < 5; i++) {
      const product = await makeProduct(5);
      const user = await makeUser();
      const order = await createOrder(user.id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);

      await Promise.allSettled([
        cancelOrder(order.id, user.id),
        confirmPaymentAndMarkPaid(order.id, 'WEBPAY', 'tok', order.totalCLP),
      ]);

      const o = await orderOf(order.id);
      const stock = await stockOf(product.id);
      const consistent =
        (o.status === 'PAID' && o.paymentStatus === 'PAID' && stock === 4) ||
        (o.status === 'CANCELLED' && o.paymentStatus === 'REFUND_PENDING' && stock === 5);
      expect(consistent, `estado inconsistente: ${o.status}/${o.paymentStatus} stock=${stock}`).toBe(true);
    }
  });

  it('el cliente no puede cancelar un pedido ya pagado', async () => {
    const product = await makeProduct(5);
    const user = await makeUser();
    const order = await createOrder(user.id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);
    await confirmPaymentAndMarkPaid(order.id, 'WEBPAY', 'tok', order.totalCLP);

    await expect(cancelOrder(order.id, user.id)).rejects.toThrow(/ya está pagado/);
    expect((await orderOf(order.id)).status).toBe('PAID');
  });

  it('nadie puede cancelar el pedido de otra persona', async () => {
    const product = await makeProduct(5);
    const owner = await makeUser();
    const other = await makeUser();
    const order = await createOrder(owner.id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);

    await expect(cancelOrder(order.id, other.id)).rejects.toThrow(/no encontrada/);
    expect((await orderOf(order.id)).status).toBe('PENDING');
  });
});

describe('Eliminación de cuenta (Ley 21.719)', () => {
  it('a los 30 días anonimiza la cuenta y los datos de entrega, conservando el pedido', async () => {
    const product = await makeProduct(5);
    const user = await makeUser({ firstName: 'Ana', consentMarketing: true });
    const order = await createOrder(user.id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);
    await requestAccountDeletion(user.id, 'prueba');

    // Antes del plazo no pasa nada
    expect(await executeDueDeletions()).toEqual({ executed: 0, postponed: 0 });

    const in31days = new Date(Date.now() + 31 * 86_400_000);
    expect(await executeDueDeletions(in31days)).toEqual({ executed: 1, postponed: 0 });

    const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(u.email).toBe(`eliminado+${user.id}@hachiko.invalid`);
    expect(u.firstName).toBeNull();
    expect(u.consentMarketing).toBe(false);
    const o = await orderOf(order.id);
    expect(o.totalCLP).toBe(order.totalCLP); // respaldo tributario intacto
    expect(o.shippingFullName).not.toBe(order.shippingFullName);
    // El email original queda libre para un registro nuevo
    await expect(makeUser({ email: user.email })).resolves.toBeTruthy();
  });

  it('si tiene un pedido aún en despacho, se posterga', async () => {
    const product = await makeProduct(5);
    const user = await makeUser();
    const order = await createOrder(user.id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);
    await confirmPaymentAndMarkPaid(order.id, 'WEBPAY', 'tok', order.totalCLP);
    await requestAccountDeletion(user.id);

    expect(await executeDueDeletions(new Date(Date.now() + 31 * 86_400_000))).toEqual({ executed: 0, postponed: 1 });
  });
});
