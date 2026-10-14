import { db } from '@/src/lib/db';
import { writeAudit } from './audit.service';
import {
  deductStockForOrder,
  InsufficientStockError,
  revalidateStock,
  withSerializableRetry,
  type Tx,
} from './inventory.service';
import { sendEmail, orderPaidEmail, orderRefundedEmail } from '@/src/lib/email';
import type { OrderStatus } from '@prisma/client';

export async function isWebhookProcessed(webhookId: string): Promise<boolean> {
  const existing = await db.processedWebhook.findUnique({ where: { id: webhookId } });
  return existing !== null;
}

export async function markWebhookProcessed(webhookId: string, provider: string): Promise<void> {
  // upsert: dos entregas simultáneas del mismo webhook no deben fallar con 500
  await db.processedWebhook.upsert({ where: { id: webhookId }, create: { id: webhookId, provider }, update: {} });
}

/**
 * Resultado de confirmar un pago:
 *  - paid           → la orden quedó pagada y el stock descontado (todo o nada).
 *  - already_paid   → webhook/commit repetido; no se hizo nada (idempotencia).
 *  - refund_pending → entró dinero que no corresponde quedarse (pedido
 *                     cancelado, monto distinto o sin stock): la orden queda
 *                     CANCELLED + REFUND_PENDING y el vendedor ve una alerta.
 *  - not_found      → la referencia no corresponde a ninguna orden.
 */
export type PaymentOutcome = 'paid' | 'already_paid' | 'refund_pending' | 'not_found';

type RefundReason = 'ORDER_CANCELLED' | 'AMOUNT_MISMATCH' | 'OUT_OF_STOCK';

// Estados de pago desde los que un cobro exitoso puede completar la orden.
// FAILED se incluye porque MercadoPago permite reintentar con otra tarjeta en
// la misma preferencia: un "rechazado" puede ir seguido de un "aprobado".
const PAYABLE = ['UNPAID', 'FAILED'] as const;

async function flagForRefund(
  tx: Tx,
  order: { id: string; status: OrderStatus },
  provider: string,
  paymentRef: string,
  reason: RefundReason,
  extra: Record<string, unknown> = {},
) {
  await tx.order.update({
    where: { id: order.id },
    data: { status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', paymentProvider: provider, paymentRef },
  });
  await tx.stockReservation.deleteMany({ where: { orderId: order.id } });
  if (order.status !== 'CANCELLED') {
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: 'CANCELLED', actorId: 'system', note: `Pago recibido pero no aplicable (${reason}): requiere reembolso` },
    });
  }
  await tx.auditLog.create({
    data: {
      action: 'PAYMENT_REQUIRES_REFUND',
      targetType: 'Order',
      targetId: order.id,
      metadata: { provider, paymentRef, reason, ...extra },
    },
  });
}

export async function confirmPaymentAndMarkPaid(
  orderId: string,
  provider: string,
  paymentRef: string,
  paidAmount?: number,
): Promise<PaymentOutcome> {
  const result = await withSerializableRetry(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return { outcome: 'not_found' as const };

    // Idempotencia: un webhook o commit repetido no procesa dos veces.
    if (order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUND_PENDING' || order.paymentStatus === 'REFUNDED') {
      return { outcome: 'already_paid' as const };
    }

    if (order.status !== 'PENDING' || !PAYABLE.includes(order.paymentStatus as (typeof PAYABLE)[number])) {
      await flagForRefund(tx, order, provider, paymentRef, 'ORDER_CANCELLED');
      return { outcome: 'refund_pending' as const, reason: 'ORDER_CANCELLED' as RefundReason };
    }

    // Fail-closed: el monto SIEMPRE debe venir de la pasarela y coincidir con el
    // total. Si llega indefinido/<=0 (respuesta anómala), no se confirma a ciegas:
    // se marca para revisión igual que un monto distinto. El importe real se
    // confirma contra la pasarela, nunca contra un dato del cliente.
    if (typeof paidAmount !== 'number' || !Number.isFinite(paidAmount) || paidAmount <= 0 || paidAmount !== order.totalCLP) {
      await flagForRefund(tx, order, provider, paymentRef, 'AMOUNT_MISMATCH', { paidAmount: paidAmount ?? null, expected: order.totalCLP });
      return { outcome: 'refund_pending' as const, reason: 'AMOUNT_MISMATCH' as RefundReason };
    }

    let touched: string[];
    try {
      touched = await deductStockForOrder(
        tx,
        orderId,
        order.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      );
    } catch (err) {
      if (!(err instanceof InsufficientStockError)) throw err;
      // deductStockForOrder valida todo antes de escribir: no hay descuento parcial.
      await flagForRefund(tx, order, provider, paymentRef, 'OUT_OF_STOCK', { productId: err.productId });
      return { outcome: 'refund_pending' as const, reason: 'OUT_OF_STOCK' as RefundReason };
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: 'PAID', paymentStatus: 'PAID', paymentProvider: provider, paymentRef, paidAt: new Date() },
    });
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: 'PENDING', toStatus: 'PAID', actorId: 'system', note: `Pago confirmado (${provider})` },
    });
    await tx.auditLog.create({
      data: {
        action: 'PAYMENT_CONFIRMED',
        targetType: 'Order',
        targetId: orderId,
        metadata: { provider, paymentRef, totalCLP: order.totalCLP },
      },
    });
    return { outcome: 'paid' as const, order, touched };
  });

  if (result.outcome === 'not_found') {
    await writeAudit({ action: 'PAYMENT_FAILED', targetType: 'Order', targetId: orderId, metadata: { provider, paymentRef, reason: 'ORDER_NOT_FOUND' } });
    return 'not_found';
  }

  if (result.outcome !== 'paid') return result.outcome;

  revalidateStock(result.touched);

  // Confirmación al cliente, FUERA de la transacción: sendEmail nunca lanza, y
  // un problema con Resend no puede deshacer un pago ya confirmado.
  const { order } = result;
  const user = await db.user.findUnique({ where: { id: order.userId }, select: { email: true, isGuest: true } });
  if (user) {
    const email = orderPaidEmail({
      orderNumber: order.orderNumber,
      items: order.items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPriceCLP: i.unitPriceCLP,
      })),
      subtotalCLP: order.subtotalCLP,
      shippingCLP: order.shippingCLP,
      totalCLP: order.totalCLP,
      shippingMethod: order.shippingMethod,
      isGuest: user.isGuest,
    });
    await sendEmail({ to: user.email, ...email });
  }
  return 'paid';
}

export async function markPaymentFailed(orderId: string, provider: string): Promise<void> {
  // Solo órdenes aún no pagadas: impide que un id forjado degrade una orden PAID
  const updated = await db.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: 'UNPAID', status: 'PENDING' },
      data: { paymentStatus: 'FAILED' },
    });
    if (count > 0) await tx.stockReservation.deleteMany({ where: { orderId } });
    return count;
  });
  if (updated === 0) return;

  await writeAudit({
    action: 'PAYMENT_FAILED',
    targetType: 'Order',
    targetId: orderId,
    metadata: { provider },
  });
}

// ─── Reembolsos ──────────────────────────────────────────

export interface RefundQueueItem {
  id: string;
  orderNumber: number;
  provider: string | null;
  amountCLP: number;
  reason: RefundReason | null;
  createdAt: Date;
  /** true si la pasarela permite devolver automáticamente (hay referencia de pago). */
  canRefundViaProvider: boolean;
}

/** Monto realmente cobrado: si no coincidía con el total, el que informó la pasarela. */
async function chargedAmount(orderId: string, totalCLP: number): Promise<{ amount: number; reason: RefundReason | null }> {
  const flag = await db.auditLog.findFirst({
    where: { action: 'PAYMENT_REQUIRES_REFUND', targetId: orderId },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  });
  const meta = (flag?.metadata ?? {}) as { paidAmount?: unknown; reason?: unknown };
  return {
    amount: typeof meta.paidAmount === 'number' && meta.paidAmount > 0 ? meta.paidAmount : totalCLP,
    reason: typeof meta.reason === 'string' ? (meta.reason as RefundReason) : null,
  };
}

/** Pagos recibidos que hay que devolver (vista del vendedor). */
export async function getRefundQueue(): Promise<RefundQueueItem[]> {
  const orders = await db.order.findMany({
    where: { paymentStatus: 'REFUND_PENDING' },
    orderBy: { updatedAt: 'asc' },
    select: { id: true, orderNumber: true, paymentProvider: true, paymentRef: true, totalCLP: true, updatedAt: true },
  });
  return Promise.all(
    orders.map(async (o) => {
      const { amount, reason } = await chargedAmount(o.id, o.totalCLP);
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        provider: o.paymentProvider,
        amountCLP: amount,
        reason,
        createdAt: o.updatedAt,
        canRefundViaProvider: Boolean(o.paymentRef && (o.paymentProvider === 'WEBPAY' || o.paymentProvider === 'MERCADOPAGO')),
      };
    }),
  );
}

/**
 * Resuelve un pago marcado para reembolso.
 *  - 'provider': pide la devolución a la pasarela (Webpay o MercadoPago).
 *  - 'manual':   el vendedor ya devolvió el dinero por fuera (p. ej. transferencia).
 *
 * El pedido se RECLAMA primero con un UPDATE condicional (REFUND_PENDING →
 * REFUNDED): un doble clic o dos vendedores a la vez no pueden devolver dos
 * veces. Si la pasarela falla, vuelve a REFUND_PENDING y el error se audita.
 */
export async function refundOrder(
  orderId: string,
  actorId: string,
  mode: 'provider' | 'manual',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, totalCLP: true, paymentStatus: true, paymentProvider: true, paymentRef: true, userId: true },
  });
  if (!order || order.paymentStatus !== 'REFUND_PENDING') {
    return { ok: false, error: 'Este pago ya no está pendiente de reembolso.' };
  }
  const { amount } = await chargedAmount(order.id, order.totalCLP);

  const claim = await db.order.updateMany({
    where: { id: orderId, paymentStatus: 'REFUND_PENDING' },
    data: { paymentStatus: 'REFUNDED' },
  });
  if (claim.count === 0) return { ok: false, error: 'Otro vendedor ya está procesando este reembolso.' };

  let providerResult: string | null = null;
  if (mode === 'provider') {
    try {
      if (!order.paymentRef) throw new Error('El pedido no tiene referencia de pago.');
      if (order.paymentProvider === 'WEBPAY') {
        const { refundWebpayTransaction } = await import('@/src/lib/payments/webpay');
        providerResult = (await refundWebpayTransaction(order.paymentRef, amount)).type;
      } else if (order.paymentProvider === 'MERCADOPAGO') {
        const { refundMpPayment } = await import('@/src/lib/payments/mercadopago');
        providerResult = (await refundMpPayment(order.paymentRef, `refund-${order.id}`)).status;
      } else {
        throw new Error('Medio de pago sin devolución automática.');
      }
    } catch (e) {
      await db.order.updateMany({ where: { id: orderId, paymentStatus: 'REFUNDED' }, data: { paymentStatus: 'REFUND_PENDING' } });
      const message = e instanceof Error ? e.message : String(e);
      await writeAudit({
        actorId,
        actorRole: 'SELLER',
        action: 'REFUND_FAILED',
        targetType: 'Order',
        targetId: orderId,
        metadata: { provider: order.paymentProvider, amount, error: message.slice(0, 300) },
      });
      return {
        ok: false,
        error: `La pasarela no aceptó la devolución (${message.slice(0, 120)}). Puedes hacerla desde su portal y marcarla como reembolsada.`,
      };
    }
  }

  await writeAudit({
    actorId,
    actorRole: 'SELLER',
    action: 'REFUND_PROCESSED',
    targetType: 'Order',
    targetId: orderId,
    metadata: { mode, provider: order.paymentProvider, amount, providerResult },
  });

  const user = await db.user.findUnique({ where: { id: order.userId }, select: { email: true } });
  if (user) {
    await sendEmail({ to: user.email, ...orderRefundedEmail({ orderNumber: order.orderNumber, amountCLP: amount, viaProvider: mode === 'provider' }) });
  }
  return { ok: true };
}
