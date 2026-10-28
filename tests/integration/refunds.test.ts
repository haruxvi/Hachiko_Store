import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { db } from '@/src/lib/db';
import { createOrder, cancelOrder } from '@/src/lib/services/order.service';
import { confirmPaymentAndMarkPaid, getRefundQueue, refundOrder } from '@/src/lib/services/payment.service';
import { PICKUP, makeProduct, makeUser, orderOf, resetDb } from './helpers';

// Las pasarelas se simulan: aquí se prueba NUESTRA lógica (reclamo atómico,
// reversión si la pasarela falla, montos), no las APIs de Transbank/MercadoPago.
const webpayRefund = vi.fn();
const mpRefund = vi.fn();
vi.mock('@/src/lib/payments/webpay', () => ({ refundWebpayTransaction: (...a: unknown[]) => webpayRefund(...a) }));
vi.mock('@/src/lib/payments/mercadopago', () => ({ refundMpPayment: (...a: unknown[]) => mpRefund(...a) }));

beforeEach(async () => {
  await resetDb();
  webpayRefund.mockReset().mockResolvedValue({ type: 'REVERSED' });
  mpRefund.mockReset().mockResolvedValue({ status: 'approved' });
});
afterAll(() => db.$disconnect());

/** Pedido pagado después de cancelarlo → queda REFUND_PENDING. */
async function refundPending(provider: 'WEBPAY' | 'MERCADOPAGO', paidAmount?: number) {
  const product = await makeProduct(5);
  const user = await makeUser();
  const order = await createOrder(user.id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);
  if (paidAmount === undefined) await cancelOrder(order.id, user.id);
  const ref = provider === 'WEBPAY' ? 'tbk-token-1' : 'mp-123';
  await confirmPaymentAndMarkPaid(order.id, provider, ref, paidAmount ?? order.totalCLP);
  return { order, seller: await makeUser({ role: 'SELLER' }) };
}

describe('Reembolsos de pagos no aplicables', () => {
  it('aparecen en la cola con motivo, pasarela y monto', async () => {
    const { order } = await refundPending('WEBPAY');
    const queue = await getRefundQueue();
    expect(queue).toEqual([
      expect.objectContaining({ id: order.id, provider: 'WEBPAY', amountCLP: order.totalCLP, reason: 'ORDER_CANCELLED', canRefundViaProvider: true }),
    ]);
  });

  it('reembolso por Webpay: llama a Transbank con el token y el monto, y cierra el caso', async () => {
    const { order, seller } = await refundPending('WEBPAY');
    expect(await refundOrder(order.id, seller.id, 'provider')).toEqual({ ok: true });
    expect(webpayRefund).toHaveBeenCalledWith('tbk-token-1', order.totalCLP);
    expect((await orderOf(order.id)).paymentStatus).toBe('REFUNDED');
    expect(await getRefundQueue()).toEqual([]);
    expect(await db.auditLog.count({ where: { action: 'REFUND_PROCESSED', targetId: order.id } })).toBe(1);
  });

  it('monto distinto: se devuelve lo que realmente se cobró, no el total del pedido', async () => {
    const { order, seller } = await refundPending('WEBPAY', 1234);
    await refundOrder(order.id, seller.id, 'provider');
    expect(webpayRefund).toHaveBeenCalledWith('tbk-token-1', 1234);
  });

  it('reembolso por MercadoPago: total con idempotency key por pedido', async () => {
    const { order, seller } = await refundPending('MERCADOPAGO');
    expect(await refundOrder(order.id, seller.id, 'provider')).toEqual({ ok: true });
    expect(mpRefund).toHaveBeenCalledWith('mp-123', `refund-${order.id}`);
  });

  it('si la pasarela rechaza, vuelve a pendiente y queda auditado', async () => {
    const { order, seller } = await refundPending('WEBPAY');
    webpayRefund.mockRejectedValueOnce(new Error('Plazo de anulación vencido'));

    const r = await refundOrder(order.id, seller.id, 'provider');
    expect(r.ok).toBe(false);
    expect((await orderOf(order.id)).paymentStatus).toBe('REFUND_PENDING');
    expect(await db.auditLog.count({ where: { action: 'REFUND_FAILED', targetId: order.id } })).toBe(1);

    // Y luego se puede cerrar a mano (devolución hecha desde el portal)
    expect(await refundOrder(order.id, seller.id, 'manual')).toEqual({ ok: true });
    expect((await orderOf(order.id)).paymentStatus).toBe('REFUNDED');
  });

  it('doble clic: la pasarela se llama UNA sola vez', async () => {
    const { order, seller } = await refundPending('WEBPAY');
    const results = await Promise.all([
      refundOrder(order.id, seller.id, 'provider'),
      refundOrder(order.id, seller.id, 'provider'),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(webpayRefund).toHaveBeenCalledTimes(1);
  });

  it('no se puede "reembolsar" un pedido pagado normal', async () => {
    const product = await makeProduct(5);
    const user = await makeUser();
    const order = await createOrder(user.id, [{ productId: product.id, quantity: 1 }], 'PICKUP', PICKUP);
    await confirmPaymentAndMarkPaid(order.id, 'WEBPAY', 'tok', order.totalCLP);

    expect((await refundOrder(order.id, user.id, 'manual')).ok).toBe(false);
    expect((await orderOf(order.id)).paymentStatus).toBe('PAID');
    expect(webpayRefund).not.toHaveBeenCalled();
  });
});
