import { db } from '@/src/lib/db';
import { writeAudit } from './audit.service';
import { markOrderPaid } from './order.service';

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
  paymentRef: string
): Promise<void> {
  const order = await markOrderPaid(orderId, provider, paymentRef);

  await writeAudit({
    action: 'PAYMENT_CONFIRMED',
    targetType: 'Order',
    targetId: orderId,
    metadata: { provider, paymentRef, totalCLP: order.totalCLP },
  });
}

export async function markPaymentFailed(orderId: string, provider: string): Promise<void> {
  await db.order.update({
    where: { id: orderId },
    data: { paymentStatus: 'FAILED' },
  });

  await writeAudit({
    action: 'PAYMENT_FAILED',
    targetType: 'Order',
    targetId: orderId,
    metadata: { provider },
  });
}
