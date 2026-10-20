import { db } from '@/src/lib/db';
import { sendEmail, pickupReminderEmail, notPickedUpEmail } from '@/src/lib/email';
import { withSerializableRetry, revalidateStock } from './inventory.service';
import { flagForRefund } from './payment.service';
import { writeAudit } from './audit.service';

// Retiro en tienda: qué pasa si nadie va a buscar el pedido.
//
// Cuando el vendedor marca un pedido PICKUP como "listo para retiro" (SHIPPED,
// shippedAt), corre un plazo de PICKUP_DEADLINE_DAYS días corridos:
//   - a los 3 y a los 10 días se envía un recordatorio por correo;
//   - vencido el plazo, el vendedor puede marcarlo "no retirado": el pedido se
//     cancela, el stock vuelve (el producto sigue en la tienda) y el pago pasa a
//     la cola de reembolsos. El dinero se devuelve completo: no retirar no hace
//     perder lo pagado.
// Los recordatorios se registran en la bitácora (PICKUP_REMINDER_SENT), así el
// cron diario nunca envía dos veces el mismo aviso.

export const PICKUP_DEADLINE_DAYS = 15;
export const PICKUP_REMINDER_DAYS = [3, 10] as const;
const DAY = 24 * 60 * 60 * 1000;

export function pickupDeadline(readyAt: Date): Date {
  return new Date(readyAt.getTime() + PICKUP_DEADLINE_DAYS * DAY);
}

/** Días completos que lleva esperando el pedido desde que quedó listo. */
export function daysWaiting(readyAt: Date, now = new Date()): number {
  return Math.floor((now.getTime() - readyAt.getTime()) / DAY);
}

const WAITING = { shippingMethod: 'PICKUP', status: 'SHIPPED', paymentStatus: 'PAID', shippedAt: { not: null } } as const;

/** Pedidos listos para retiro con el plazo ya vencido (para la alerta del panel). */
export async function countOverduePickups(now = new Date()): Promise<number> {
  return db.order.count({ where: { ...WAITING, shippedAt: { lt: new Date(now.getTime() - PICKUP_DEADLINE_DAYS * DAY) } } });
}

/** Cron diario: recordatorios de retiro pendientes. Devuelve cuántos correos se enviaron. */
export async function sendPickupReminders(now = new Date()): Promise<number> {
  const orders = await db.order.findMany({
    where: { ...WAITING, shippedAt: { lte: new Date(now.getTime() - PICKUP_REMINDER_DAYS[0] * DAY) } },
    select: { id: true, orderNumber: true, shippedAt: true, user: { select: { email: true } } },
  });
  let sent = 0;
  for (const o of orders) {
    const readyAt = o.shippedAt!;
    if (now > pickupDeadline(readyAt)) continue; // vencido: ahora decide el vendedor
    const already = await db.auditLog.count({ where: { action: 'PICKUP_REMINDER_SENT', targetId: o.id } });
    const due = PICKUP_REMINDER_DAYS.filter((d) => daysWaiting(readyAt, now) >= d).length;
    if (already >= due) continue;
    const lastReminder = already + 1 >= PICKUP_REMINDER_DAYS.length;
    await sendEmail({ to: o.user.email, ...pickupReminderEmail({ orderNumber: o.orderNumber, deadline: pickupDeadline(readyAt), lastReminder }) });
    await writeAudit({ action: 'PICKUP_REMINDER_SENT', targetType: 'Order', targetId: o.id, metadata: { reminder: already + 1 } });
    sent++;
  }
  return sent;
}

/**
 * Vencido el plazo, el vendedor marca el pedido como no retirado. Todo en una
 * transacción: devuelve el stock (movimiento RETURNED), cancela el pedido y lo
 * deja en la cola de reembolsos. Antes del plazo se rechaza.
 */
export async function markOrderNotPickedUp(orderId: string, actorId: string, now = new Date()) {
  const result = await withSerializableRetry(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.shippingMethod !== 'PICKUP' || order.status !== 'SHIPPED' || order.paymentStatus !== 'PAID' || !order.shippedAt) {
      throw new Error('Solo un pedido pagado y listo para retiro puede marcarse como no retirado.');
    }
    const deadline = pickupDeadline(order.shippedAt);
    if (now <= deadline) {
      throw new Error(
        `Aún está dentro del plazo de retiro (vence el ${deadline.toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })}).`,
      );
    }

    // El producto nunca salió de la tienda: vuelve al stock.
    for (const item of order.items) {
      const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId }, select: { stock: true } });
      await tx.product.update({ where: { id: item.productId }, data: { stock: product.stock + item.quantity } });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'IN',
          reason: 'RETURNED',
          quantity: item.quantity,
          previousStock: product.stock,
          resultingStock: product.stock + item.quantity,
          orderId: order.id,
          actorId,
          notes: `Pedido #${order.orderNumber} no retirado`,
        },
      });
    }

    await flagForRefund(tx, order, order.paymentProvider ?? 'MANUAL', order.paymentRef ?? '', 'NOT_PICKED_UP', { daysWaiting: daysWaiting(order.shippedAt, now) });
    return { order, productIds: order.items.map((i) => i.productId) };
  });

  revalidateStock(result.productIds);
  await writeAudit({ actorId, actorRole: 'SELLER', action: 'ORDER_NOT_PICKED_UP', targetType: 'Order', targetId: orderId });
  const user = await db.user.findUnique({ where: { id: result.order.userId }, select: { email: true } });
  if (user) await sendEmail({ to: user.email, ...notPickedUpEmail({ orderNumber: result.order.orderNumber }) });
  return result.order;
}
