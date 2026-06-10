import { db } from '@/src/lib/db';
import { writeAudit } from './audit.service';
import { confirmStockDeduction, releaseReservation } from './inventory.service';

export async function isWebhookProcessed(webhookId: string): Promise<boolean> {
  const existing = await db.processedWebhook.findUnique({ where: { id: webhookId } });
  return existing !== null;
}

export async function markWebhookProcessed(webhookId: string, provider: string): Promise<void> {
  await db.processedWebhook.create({ data: { id: webhookId, provider } });
}

export async function confirmPaymentAndMarkPaid(
  orderId: string,
  provider: string,
  paymentRef: string,
  paidAmount?: number,
): Promise<void> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`Orden no encontrada: ${orderId}`);

  // Idempotencia: un webhook o commit repetido no debe procesar dos veces
  if (order.paymentStatus === 'PAID') return;

  // El monto pagado debe coincidir con el total de la orden
  if (paidAmount !== undefined && paidAmount !== order.totalCLP) {
    await writeAudit({
      action: 'PAYMENT_FAILED',
      targetType: 'Order',
      targetId: orderId,
      metadata: { provider, paymentRef, reason: 'AMOUNT_MISMATCH', paidAmount, expected: order.totalCLP },
    });
    throw new Error(
      `Monto pagado (${paidAmount}) no coincide con el total de la orden (${order.totalCLP})`,
    );
  }

  // Solo transiciona órdenes UNPAID; updateMany evita pisar otros estados en carreras
  const updated = await db.order.updateMany({
    where: { id: orderId, paymentStatus: 'UNPAID' },
    data: {
      status: 'PAID',
      paymentStatus: 'PAID',
      paymentProvider: provider,
      paymentRef,
      paidAt: new Date(),
    },
  });
  if (updated.count === 0) return;

  await confirmStockDeduction(orderId, null);

  await writeAudit({
    action: 'PAYMENT_CONFIRMED',
    targetType: 'Order',
    targetId: orderId,
    metadata: { provider, paymentRef, totalCLP: order.totalCLP },
  });
}

export async function markPaymentFailed(orderId: string, provider: string): Promise<void> {
  // Solo órdenes aún no pagadas: impide que un id forjado degrade una orden PAID
  const updated = await db.order.updateMany({
    where: { id: orderId, paymentStatus: 'UNPAID' },
    data: { paymentStatus: 'FAILED' },
  });
  if (updated.count === 0) return;

  await releaseReservation(orderId);

  await writeAudit({
    action: 'PAYMENT_FAILED',
    targetType: 'Order',
    targetId: orderId,
    metadata: { provider },
  });
}
