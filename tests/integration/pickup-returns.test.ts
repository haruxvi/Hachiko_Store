import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { db } from '@/src/lib/db';
import { createOrder, markOrderDelivered, markOrderShipped } from '@/src/lib/services/order.service';
import { confirmPaymentAndMarkPaid, getRefundQueue } from '@/src/lib/services/payment.service';
import { countOverduePickups, markOrderNotPickedUp, sendPickupReminders } from '@/src/lib/services/pickup.service';
import {
  approveReturn,
  createReturnRequest,
  receiveReturn,
  rejectReturn,
  resolveReturn,
  ReturnError,
} from '@/src/lib/services/returns.service';
import { PICKUP, makeProduct, makeUser, orderOf, resetDb, stockOf } from './helpers';

// Pedidos del profesor: retiros no buscados y cambios/devoluciones (Ley 19.496),
// contra Postgres real. Las pasarelas se simulan.
const webpayRefund = vi.fn();
const mpRefund = vi.fn();
vi.mock('@/src/lib/payments/webpay', () => ({ refundWebpayTransaction: (...a: unknown[]) => webpayRefund(...a) }));
vi.mock('@/src/lib/payments/mercadopago', () => ({ refundMpPaymentPartial: (...a: unknown[]) => mpRefund(...a) }));

const DAY = 24 * 60 * 60 * 1000;
const daysFrom = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

beforeEach(async () => {
  await resetDb();
  webpayRefund.mockReset().mockResolvedValue({ type: 'NULLIFIED' });
  mpRefund.mockReset().mockResolvedValue({ status: 'approved' });
});
afterAll(() => db.$disconnect());

/** Pedido pagado y marcado listo para retiro (o entregado si deliver=true). */
async function paidOrder(opts: { stock?: number; qty?: number; price?: number; method?: 'PICKUP' | 'STARKEN' } = {}) {
  const product = await makeProduct(opts.stock ?? 10, opts.price ?? 10_000);
  const client = await makeUser();
  const seller = await makeUser({ role: 'SELLER' });
  const address =
    opts.method === 'STARKEN'
      ? { ...PICKUP, street: 'Calle', number: '1', commune: 'Recoleta', region: 'RM' }
      : PICKUP;
  const order = await createOrder(client.id, [{ productId: product.id, quantity: opts.qty ?? 2 }], opts.method ?? 'PICKUP', address);
  await confirmPaymentAndMarkPaid(order.id, 'WEBPAY', 'tbk-token-1', order.totalCLP);
  await markOrderShipped(order.id, null, seller.id, 'SELLER');
  return { product, client, seller, order: await orderOf(order.id) };
}

async function deliveredOrder(opts: Parameters<typeof paidOrder>[0] = {}) {
  const ctx = await paidOrder(opts);
  await markOrderDelivered(ctx.order.id, ctx.seller.id);
  return { ...ctx, order: await orderOf(ctx.order.id) };
}

const itemsOf = async (orderId: string, qty = 1) =>
  (await db.orderItem.findMany({ where: { orderId } })).map((i) => ({ orderItemId: i.id, quantity: qty }));

describe('Retiro en tienda no buscado', () => {
  it('recordatorios a los 3 y 10 días, sin repetirse', async () => {
    const { order } = await paidOrder();
    const readyAt = order.shippedAt!;

    expect(await sendPickupReminders(daysFrom(readyAt, 1))).toBe(0);
    expect(await sendPickupReminders(daysFrom(readyAt, 4))).toBe(1);
    expect(await sendPickupReminders(daysFrom(readyAt, 5))).toBe(0); // el cron corre todos los días: no repite
    expect(await sendPickupReminders(daysFrom(readyAt, 11))).toBe(1);
    expect(await sendPickupReminders(daysFrom(readyAt, 12))).toBe(0);
    expect(await db.auditLog.count({ where: { action: 'PICKUP_REMINDER_SENT', targetId: order.id } })).toBe(2);
  });

  it('no se puede marcar "no retirado" antes de que venza el plazo', async () => {
    const { order, seller } = await paidOrder();
    await expect(markOrderNotPickedUp(order.id, seller.id, daysFrom(order.shippedAt!, 10))).rejects.toThrow(/dentro del plazo/);
    expect((await orderOf(order.id)).status).toBe('SHIPPED');
  });

  it('vencido el plazo: cancela, devuelve el stock y deja el pago para reembolso', async () => {
    const { order, seller, product } = await paidOrder({ stock: 10, qty: 2 });
    expect(await stockOf(product.id)).toBe(8);
    expect(await countOverduePickups(daysFrom(order.shippedAt!, 16))).toBe(1);

    await markOrderNotPickedUp(order.id, seller.id, daysFrom(order.shippedAt!, 16));

    const o = await orderOf(order.id);
    expect(o.status).toBe('CANCELLED');
    expect(o.paymentStatus).toBe('REFUND_PENDING');
    expect(await stockOf(product.id)).toBe(10);
    const mv = await db.stockMovement.findFirst({ where: { orderId: order.id, reason: 'RETURNED' } });
    expect(mv?.quantity).toBe(2);
    expect(await getRefundQueue()).toEqual([expect.objectContaining({ id: order.id, reason: 'NOT_PICKED_UP', amountCLP: order.totalCLP })]);
  });

  it('un pedido con despacho a domicilio no se puede marcar como no retirado', async () => {
    const { order, seller } = await paidOrder({ method: 'STARKEN' });
    await expect(markOrderNotPickedUp(order.id, seller.id, daysFrom(new Date(), 30))).rejects.toThrow(/listo para retiro/);
  });
});

describe('Cambios y devoluciones (Ley 19.496)', () => {
  const base = { reason: 'El producto llegó con una falla.' };

  it('retracto dentro de 10 días: se crea la solicitud', async () => {
    const { order, client } = await deliveredOrder();
    const r = await createReturnRequest(client.id, { ...base, orderId: order.id, type: 'RETRACTO', resolution: 'REFUND', items: await itemsOf(order.id) });
    expect(r.status).toBe('REQUESTED');
    expect(await db.auditLog.count({ where: { action: 'RETURN_REQUESTED', targetId: r.id } })).toBe(1);
  });

  it('retracto no admite reparación (solo cambio o devolución)', async () => {
    const { order, client } = await deliveredOrder();
    await expect(
      createReturnRequest(client.id, { ...base, orderId: order.id, type: 'RETRACTO', resolution: 'REPAIR', items: await itemsOf(order.id) }),
    ).rejects.toBeInstanceOf(ReturnError);
  });

  it('pasados 10 días ya no hay retracto, pero sí garantía; pasados 6 meses, nada', async () => {
    const { order, client } = await deliveredOrder();
    const items = await itemsOf(order.id);
    const d11 = daysFrom(order.deliveredAt!, 11);
    await expect(createReturnRequest(client.id, { ...base, orderId: order.id, type: 'RETRACTO', resolution: 'REFUND', items }, d11)).rejects.toThrow(/retracto/);
    const g = await createReturnRequest(client.id, { ...base, orderId: order.id, type: 'GARANTIA', resolution: 'REPAIR', items }, d11);
    expect(g.type).toBe('GARANTIA');

    await rejectReturn(g.id, (await makeUser({ role: 'SELLER' })).id, 'Prueba de plazo: se rechaza para volver a pedir.');
    const d200 = daysFrom(order.deliveredAt!, 200);
    await expect(createReturnRequest(client.id, { ...base, orderId: order.id, type: 'GARANTIA', resolution: 'REFUND', items }, d200)).rejects.toThrow(/garantía/);
  });

  it('solo pedidos entregados y del propio cliente', async () => {
    const { order, client } = await paidOrder(); // listo para retiro, aún no entregado
    await expect(
      createReturnRequest(client.id, { ...base, orderId: order.id, type: 'GARANTIA', resolution: 'REFUND', items: await itemsOf(order.id) }),
    ).rejects.toThrow(/entregado/);

    const delivered = await deliveredOrder();
    const stranger = await makeUser();
    await expect(
      createReturnRequest(stranger.id, { ...base, orderId: delivered.order.id, type: 'GARANTIA', resolution: 'REFUND', items: await itemsOf(delivered.order.id) }),
    ).rejects.toThrow(/no encontrado/);
  });

  it('no se pueden devolver más unidades de las compradas ni abrir dos solicitudes a la vez', async () => {
    const { order, client } = await deliveredOrder({ qty: 2 });
    await expect(
      createReturnRequest(client.id, { ...base, orderId: order.id, type: 'GARANTIA', resolution: 'REFUND', items: await itemsOf(order.id, 3) }),
    ).rejects.toThrow(/hasta 2/);
    await createReturnRequest(client.id, { ...base, orderId: order.id, type: 'GARANTIA', resolution: 'REFUND', items: await itemsOf(order.id, 1) });
    await expect(
      createReturnRequest(client.id, { ...base, orderId: order.id, type: 'GARANTIA', resolution: 'REFUND', items: await itemsOf(order.id, 1) }),
    ).rejects.toThrow(/en curso/);
  });

  it('flujo completo de devolución del dinero: aprobar → recibir (vuelve al stock) → devolver solo lo de los productos', async () => {
    const { order, client, seller, product } = await deliveredOrder({ stock: 10, qty: 2, price: 10_000 });
    const r = await createReturnRequest(client.id, { ...base, orderId: order.id, type: 'RETRACTO', resolution: 'REFUND', items: await itemsOf(order.id, 1) });

    await approveReturn(r.id, seller.id, 'Tráelo a la tienda de lunes a viernes.');
    await receiveReturn(r.id, seller.id, true);
    expect(await stockOf(product.id)).toBe(9); // 10 - 2 vendidos + 1 devuelto
    await resolveReturn(r.id, seller.id, { refundMode: 'provider' });

    expect(webpayRefund).toHaveBeenCalledWith('tbk-token-1', 10_000); // 1 unidad, sin el envío
    const done = await db.returnRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(done.status).toBe('RESOLVED');
    expect(done.refundCLP).toBe(10_000);
  });

  it('si la pasarela rechaza la devolución, vuelve a "recibido" y queda auditado', async () => {
    const { order, client, seller } = await deliveredOrder();
    const r = await createReturnRequest(client.id, { ...base, orderId: order.id, type: 'GARANTIA', resolution: 'REFUND', items: await itemsOf(order.id) });
    await approveReturn(r.id, seller.id, 'Envíalo por Starken.');
    await receiveReturn(r.id, seller.id, false);
    webpayRefund.mockRejectedValueOnce(new Error('Plazo de anulación vencido'));

    await expect(resolveReturn(r.id, seller.id, { refundMode: 'provider' })).rejects.toThrow(/pasarela/);
    expect((await db.returnRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('RECEIVED');
    expect(await db.auditLog.count({ where: { action: 'REFUND_FAILED', targetId: r.id } })).toBe(1);

    await resolveReturn(r.id, seller.id, { refundMode: 'manual' });
    expect((await db.returnRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('RESOLVED');
  });

  it('cambio: descuenta del stock la unidad nueva; sin stock, no se puede', async () => {
    const { order, client, seller, product } = await deliveredOrder({ stock: 3, qty: 2 });
    const r = await createReturnRequest(client.id, { ...base, orderId: order.id, type: 'GARANTIA', resolution: 'EXCHANGE', items: await itemsOf(order.id, 1) });
    await approveReturn(r.id, seller.id, 'Tráelo a la tienda.');
    await receiveReturn(r.id, seller.id, false); // con falla: no vuelve al stock
    expect(await stockOf(product.id)).toBe(1);

    await resolveReturn(r.id, seller.id);
    expect(await stockOf(product.id)).toBe(0);
    expect((await db.stockMovement.findFirst({ where: { orderId: order.id, reason: 'EXCHANGE' } }))?.quantity).toBe(-1);

    // Segunda unidad: ya no queda stock para el cambio
    const r2 = await createReturnRequest(client.id, { ...base, orderId: order.id, type: 'GARANTIA', resolution: 'EXCHANGE', items: await itemsOf(order.id, 1) });
    await approveReturn(r2.id, seller.id, 'Tráelo a la tienda.');
    await receiveReturn(r2.id, seller.id, false);
    await expect(resolveReturn(r2.id, seller.id)).rejects.toThrow(/No hay stock/);
    expect((await db.returnRequest.findUniqueOrThrow({ where: { id: r2.id } })).status).toBe('RECEIVED');
  });

  it('doble clic al devolver el dinero: la pasarela se llama una sola vez', async () => {
    const { order, client, seller } = await deliveredOrder();
    const r = await createReturnRequest(client.id, { ...base, orderId: order.id, type: 'GARANTIA', resolution: 'REFUND', items: await itemsOf(order.id) });
    await approveReturn(r.id, seller.id, 'Tráelo a la tienda.');
    await receiveReturn(r.id, seller.id, false);

    const results = await Promise.allSettled([
      resolveReturn(r.id, seller.id, { refundMode: 'provider' }),
      resolveReturn(r.id, seller.id, { refundMode: 'provider' }),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(webpayRefund).toHaveBeenCalledTimes(1);
  });

  it('rechazar exige motivo y no se permite si el producto ya volvió al stock', async () => {
    const { order, client, seller } = await deliveredOrder();
    const r = await createReturnRequest(client.id, { ...base, orderId: order.id, type: 'RETRACTO', resolution: 'REFUND', items: await itemsOf(order.id) });
    await expect(rejectReturn(r.id, seller.id, 'no')).rejects.toThrow(/motivo/);
    await approveReturn(r.id, seller.id, 'Tráelo a la tienda.');
    await receiveReturn(r.id, seller.id, true);
    await expect(rejectReturn(r.id, seller.id, 'El producto estaba abierto y sin falla.')).rejects.toThrow(/ya no se puede rechazar/);
  });
});
