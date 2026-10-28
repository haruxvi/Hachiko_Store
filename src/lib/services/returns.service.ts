import { addMonths } from 'date-fns';
import type { ReturnResolution, ReturnStatus, ReturnType } from '@prisma/client';
import { db } from '@/src/lib/db';
import { sendEmail, returnRequestedEmail, returnUpdateEmail } from '@/src/lib/email';
import { activeReservations, revalidateStock, withSerializableRetry } from './inventory.service';
import { writeAudit } from './audit.service';
import type { ReturnRequestSchema } from '@/src/lib/validation/schemas';
import type { z } from 'zod';

// Cambios y devoluciones según la Ley 19.496 (ver modelo ReturnRequest).
//
//   RETRACTO  · 10 días corridos desde la recepción · cambio o devolución.
//   GARANTIA  · 6 meses desde la recepción (Ley 21.398) · el CLIENTE elige
//               cambio, reparación o devolución (triple opción).
//
// Flujo: REQUESTED (cliente) → APPROVED (tienda indica cómo entregar) →
// RECEIVED (tienda recibe; si sirve, vuelve al stock) → RESOLVED (cambio
// entregado, dinero devuelto o reparado). REJECTED siempre con motivo escrito.
// Cada paso es un UPDATE condicional (dos clics no avanzan dos veces) y queda
// en la bitácora.

export const RETRACTO_DAYS = 10;
export const GARANTIA_MONTHS = 6;
const DAY = 24 * 60 * 60 * 1000;
const OPEN: ReturnStatus[] = ['REQUESTED', 'APPROVED', 'RECEIVED'];

export const RESOLUTIONS_BY_TYPE: Record<ReturnType, ReturnResolution[]> = {
  RETRACTO: ['EXCHANGE', 'REFUND'],
  GARANTIA: ['EXCHANGE', 'REPAIR', 'REFUND'],
};

export class ReturnError extends Error {}

/** Plazos abiertos para un pedido recibido en `receivedAt`. */
export function returnWindows(receivedAt: Date, now = new Date()) {
  const retractoUntil = new Date(receivedAt.getTime() + RETRACTO_DAYS * DAY);
  const garantiaUntil = addMonths(receivedAt, GARANTIA_MONTHS);
  return {
    RETRACTO: { open: now <= retractoUntil, until: retractoUntil },
    GARANTIA: { open: now <= garantiaUntil, until: garantiaUntil },
  };
}

/** Fecha desde la que corren los plazos: la entrega (o el despacho, en pedidos antiguos). */
const receivedAtOf = (o: { deliveredAt: Date | null; shippedAt: Date | null }) => o.deliveredAt ?? o.shippedAt;

type ItemWithReturns = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCLP: number;
  returnItems: { quantity: number; request: { status: ReturnStatus } }[];
};

/** Unidades de un ítem que todavía se pueden incluir en una solicitud (descontando las ya pedidas, salvo rechazadas). */
function returnableQty(item: ItemWithReturns): number {
  const used = item.returnItems.filter((r) => r.request.status !== 'REJECTED').reduce((a, r) => a + r.quantity, 0);
  return Math.max(0, item.quantity - used);
}

const ITEMS_WITH_RETURNS = {
  include: { returnItems: { select: { quantity: true, request: { select: { status: true } } } } },
} as const;

/** Lo que necesita el formulario del cliente: plazos, ítems y si ya hay una solicitud en curso. */
export async function getReturnableOrder(orderId: string, userId: string, now = new Date()) {
  const order = await db.order.findFirst({
    where: { id: orderId, userId },
    include: { items: ITEMS_WITH_RETURNS, returns: { where: { status: { in: OPEN } }, select: { requestNumber: true } } },
  });
  if (!order) return null;
  const receivedAt = receivedAtOf(order);
  const eligible = order.status === 'DELIVERED' && order.paymentStatus === 'PAID' && receivedAt !== null;
  const windows = receivedAt ? returnWindows(receivedAt, now) : null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    shippingMethod: order.shippingMethod,
    eligible,
    receivedAt,
    windows,
    openRequest: order.returns[0]?.requestNumber ?? null,
    items: order.items.map((i) => ({
      orderItemId: i.id,
      productName: i.productName,
      quantity: i.quantity,
      unitPriceCLP: i.unitPriceCLP,
      returnable: returnableQty(i),
    })),
  };
}

export async function createReturnRequest(userId: string, input: z.infer<typeof ReturnRequestSchema>, now = new Date()) {
  if (!RESOLUTIONS_BY_TYPE[input.type].includes(input.resolution)) {
    throw new ReturnError(
      input.type === 'RETRACTO'
        ? 'Con el derecho a retracto puedes pedir cambio o devolución del dinero.'
        : 'Opción no válida.',
    );
  }

  const request = await withSerializableRetry(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: input.orderId, userId },
      include: { items: ITEMS_WITH_RETURNS, returns: { where: { status: { in: OPEN } }, select: { id: true } } },
    });
    if (!order) throw new ReturnError('Pedido no encontrado.');
    const receivedAt = receivedAtOf(order);
    if (order.status !== 'DELIVERED' || order.paymentStatus !== 'PAID' || !receivedAt) {
      throw new ReturnError('Solo puedes pedir un cambio o devolución de un pedido ya entregado.');
    }
    if (order.returns.length > 0) {
      throw new ReturnError('Ya tienes una solicitud en curso para este pedido. Te avisaremos cuando avance.');
    }
    const window = returnWindows(receivedAt, now)[input.type];
    if (!window.open) {
      throw new ReturnError(
        input.type === 'RETRACTO'
          ? `El plazo de retracto (${RETRACTO_DAYS} días desde que recibiste el pedido) ya venció. Si el producto tiene una falla, usa la garantía legal.`
          : `La garantía legal (${GARANTIA_MONTHS} meses desde que recibiste el pedido) ya venció.`,
      );
    }

    const byId = new Map(order.items.map((i) => [i.id, i]));
    const seen = new Set<string>();
    for (const line of input.items) {
      const item = byId.get(line.orderItemId);
      if (!item || seen.has(line.orderItemId)) throw new ReturnError('Uno de los productos no pertenece a este pedido.');
      seen.add(line.orderItemId);
      if (line.quantity > returnableQty(item)) {
        throw new ReturnError(`Puedes incluir hasta ${returnableQty(item)} unidad(es) de ${item.productName}.`);
      }
    }

    return tx.returnRequest.create({
      data: {
        orderId: order.id,
        userId,
        type: input.type,
        resolution: input.resolution,
        reason: input.reason,
        items: { create: input.items.map((l) => ({ orderItemId: l.orderItemId, quantity: l.quantity })) },
      },
      include: { order: { select: { orderNumber: true } } },
    });
  });

  await writeAudit({
    actorId: userId,
    actorRole: 'CLIENT',
    action: 'RETURN_REQUESTED',
    targetType: 'ReturnRequest',
    targetId: request.id,
    metadata: { type: request.type, resolution: request.resolution, orderId: request.orderId },
  });
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (user) {
    await sendEmail({
      to: user.email,
      ...returnRequestedEmail({ requestNumber: request.requestNumber, orderNumber: request.order.orderNumber, resolution: request.resolution }),
    });
  }
  return request;
}

// ─── Vendedor ─────────────────────────────────────────────

const DETAIL = {
  include: {
    order: { select: { id: true, orderNumber: true, paymentProvider: true, paymentRef: true, user: { select: { email: true } } } },
    items: { include: { orderItem: { select: { productId: true, productName: true, unitPriceCLP: true } } } },
  },
} as const;

async function notify(returnId: string, status: 'APPROVED' | 'REJECTED' | 'RECEIVED' | 'RESOLVED') {
  const r = await db.returnRequest.findUniqueOrThrow({ where: { id: returnId }, ...DETAIL });
  await sendEmail({
    to: r.order.user.email,
    ...returnUpdateEmail({
      requestNumber: r.requestNumber,
      orderNumber: r.order.orderNumber,
      status,
      resolution: r.resolution,
      note: r.sellerNote,
      refundCLP: r.refundCLP,
    }),
  });
}

/** Avanza el estado solo si está en uno de los permitidos (UPDATE condicional). */
async function transition(returnId: string, from: ReturnStatus[], data: Parameters<typeof db.returnRequest.updateMany>[0]['data'], error: string) {
  const { count } = await db.returnRequest.updateMany({ where: { id: returnId, status: { in: from } }, data });
  if (count === 0) throw new ReturnError(error);
}

export async function approveReturn(returnId: string, actorId: string, note: string) {
  if (note.trim().length < 5) throw new ReturnError('Indica al cliente cómo entregar el producto (dirección, horario o despacho).');
  await transition(
    returnId,
    ['REQUESTED'],
    { status: 'APPROVED', sellerNote: note.trim(), decidedById: actorId, decidedAt: new Date() },
    'Esta solicitud ya no está pendiente de revisión.',
  );
  await writeAudit({ actorId, actorRole: 'SELLER', action: 'RETURN_APPROVED', targetType: 'ReturnRequest', targetId: returnId });
  await notify(returnId, 'APPROVED');
}

export async function rejectReturn(returnId: string, actorId: string, note: string) {
  if (note.trim().length < 10) throw new ReturnError('Explica al cliente el motivo del rechazo (mínimo 10 caracteres).');
  // Una vez devuelto al stock ya no se puede rechazar: habría que devolverle al cliente un producto que ya se vendió.
  const { count } = await db.returnRequest.updateMany({
    where: { id: returnId, OR: [{ status: { in: ['REQUESTED', 'APPROVED'] } }, { status: 'RECEIVED', restocked: false }] },
    data: { status: 'REJECTED', sellerNote: note.trim(), decidedById: actorId, decidedAt: new Date() },
  });
  if (count === 0) throw new ReturnError('Esta solicitud ya no se puede rechazar.');
  await writeAudit({ actorId, actorRole: 'SELLER', action: 'RETURN_REJECTED', targetType: 'ReturnRequest', targetId: returnId });
  await notify(returnId, 'REJECTED');
}

/**
 * La tienda recibió el producto. Si está en condiciones de venderse otra vez
 * (`restock`), vuelve al stock con un movimiento RETURNED; si tiene falla, no.
 */
export async function receiveReturn(returnId: string, actorId: string, restock: boolean) {
  const productIds = await withSerializableRetry(async (tx) => {
    const r = await tx.returnRequest.findUnique({ where: { id: returnId }, ...DETAIL });
    if (!r || r.status !== 'APPROVED') throw new ReturnError('Primero aprueba la solicitud; luego marca el producto como recibido.');
    await tx.returnRequest.update({ where: { id: returnId }, data: { status: 'RECEIVED', receivedAt: new Date(), restocked: restock } });
    if (!restock) return [];
    for (const it of r.items) {
      const product = await tx.product.findUniqueOrThrow({ where: { id: it.orderItem.productId }, select: { stock: true } });
      await tx.product.update({ where: { id: it.orderItem.productId }, data: { stock: product.stock + it.quantity } });
      await tx.stockMovement.create({
        data: {
          productId: it.orderItem.productId,
          type: 'IN',
          reason: 'RETURNED',
          quantity: it.quantity,
          previousStock: product.stock,
          resultingStock: product.stock + it.quantity,
          orderId: r.order.id,
          actorId,
          notes: `Devolución · solicitud #${r.requestNumber}`,
        },
      });
    }
    return r.items.map((it) => it.orderItem.productId);
  });
  if (productIds.length) revalidateStock(productIds);
  await writeAudit({ actorId, actorRole: 'SELLER', action: 'RETURN_RECEIVED', targetType: 'ReturnRequest', targetId: returnId, metadata: { restock } });
  await notify(returnId, 'RECEIVED');
}

/**
 * Cierra la solicitud según lo que eligió el cliente:
 *  - EXCHANGE: entrega una unidad nueva del mismo producto (descuenta stock, movimiento EXCHANGE);
 *  - REFUND: devuelve el valor de los productos por la pasarela ('provider') o registra una devolución hecha por fuera ('manual');
 *  - REPAIR: registra la reparación.
 */
export async function resolveReturn(returnId: string, actorId: string, opts: { refundMode?: 'provider' | 'manual'; note?: string } = {}) {
  const r = await db.returnRequest.findUnique({ where: { id: returnId }, ...DETAIL });
  if (!r || r.status !== 'RECEIVED') throw new ReturnError('Solo se resuelve una solicitud con el producto ya recibido.');
  const note = opts.note?.trim() || null;
  const resolved = { status: 'RESOLVED' as const, resolvedAt: new Date(), ...(note ? { sellerNote: note } : {}) };

  if (r.resolution === 'EXCHANGE') {
    const productIds = await withSerializableRetry(async (tx) => {
      const ids = r.items.map((it) => it.orderItem.productId);
      const [products, reserved] = await Promise.all([
        tx.product.findMany({ where: { id: { in: ids } }, select: { id: true, stock: true, name: true } }),
        activeReservations(tx, ids),
      ]);
      const byId = new Map(products.map((p) => [p.id, p]));
      for (const it of r.items) {
        const p = byId.get(it.orderItem.productId)!;
        if (p.stock - (reserved.get(p.id) ?? 0) < it.quantity) {
          throw new ReturnError(`No hay stock de ${p.name} para el cambio. Ofrece al cliente la devolución del dinero o espera la reposición.`);
        }
      }
      const { count } = await tx.returnRequest.updateMany({ where: { id: returnId, status: 'RECEIVED' }, data: resolved });
      if (count === 0) throw new ReturnError('Esta solicitud ya fue resuelta.');
      for (const it of r.items) {
        const p = byId.get(it.orderItem.productId)!;
        await tx.product.update({ where: { id: p.id }, data: { stock: p.stock - it.quantity } });
        await tx.stockMovement.create({
          data: {
            productId: p.id,
            type: 'OUT',
            reason: 'EXCHANGE',
            quantity: -it.quantity,
            previousStock: p.stock,
            resultingStock: p.stock - it.quantity,
            orderId: r.order.id,
            actorId,
            notes: `Cambio · solicitud #${r.requestNumber}`,
          },
        });
        p.stock -= it.quantity;
      }
      return ids;
    });
    revalidateStock(productIds);
  } else if (r.resolution === 'REFUND') {
    const amount = r.items.reduce((a, it) => a + it.orderItem.unitPriceCLP * it.quantity, 0);
    // Reclamo atómico ANTES de llamar a la pasarela: un doble clic no devuelve dos veces.
    await transition(returnId, ['RECEIVED'], { ...resolved, refundCLP: amount }, 'Esta solicitud ya fue resuelta.');
    if (opts.refundMode !== 'manual') {
      try {
        if (!r.order.paymentRef) throw new Error('El pedido no tiene referencia de pago.');
        if (r.order.paymentProvider === 'WEBPAY') {
          const { refundWebpayTransaction } = await import('@/src/lib/payments/webpay');
          await refundWebpayTransaction(r.order.paymentRef, amount);
        } else if (r.order.paymentProvider === 'MERCADOPAGO') {
          const { refundMpPaymentPartial } = await import('@/src/lib/payments/mercadopago');
          await refundMpPaymentPartial(r.order.paymentRef, amount, `return-${r.id}`);
        } else {
          throw new Error('Medio de pago sin devolución automática.');
        }
      } catch (e) {
        await db.returnRequest.updateMany({
          where: { id: returnId, status: 'RESOLVED' },
          data: { status: 'RECEIVED', resolvedAt: null, refundCLP: null },
        });
        const message = e instanceof Error ? e.message : String(e);
        await writeAudit({
          actorId,
          actorRole: 'SELLER',
          action: 'REFUND_FAILED',
          targetType: 'ReturnRequest',
          targetId: returnId,
          metadata: { amount, error: message.slice(0, 300) },
        });
        throw new ReturnError(
          `La pasarela no aceptó la devolución (${message.slice(0, 120)}). Puedes hacerla desde su portal y marcarla como devuelta por fuera.`,
        );
      }
    }
  } else {
    await transition(returnId, ['RECEIVED'], resolved, 'Esta solicitud ya fue resuelta.');
  }

  await writeAudit({
    actorId,
    actorRole: 'SELLER',
    action: 'RETURN_RESOLVED',
    targetType: 'ReturnRequest',
    targetId: returnId,
    metadata: { resolution: r.resolution, refundMode: r.resolution === 'REFUND' ? (opts.refundMode ?? 'provider') : undefined },
  });
  await notify(returnId, 'RESOLVED');
}

// ─── Lecturas ─────────────────────────────────────────────

export async function countPendingReturns(): Promise<number> {
  return db.returnRequest.count({ where: { status: 'REQUESTED' } });
}

export type ReturnFilter = 'pendientes' | 'en-curso' | 'cerradas' | 'todas';
const FILTER_STATUSES: Record<ReturnFilter, ReturnStatus[]> = {
  pendientes: ['REQUESTED'],
  'en-curso': ['APPROVED', 'RECEIVED'],
  cerradas: ['RESOLVED', 'REJECTED'],
  todas: ['REQUESTED', 'APPROVED', 'RECEIVED', 'RESOLVED', 'REJECTED'],
};

export async function listReturns(filter: ReturnFilter, q: string) {
  const term = q.replace(/^#\s*/, '');
  const asNumber = /^\d+$/.test(term) ? Number(term) : null;
  const rows = await db.returnRequest.findMany({
    where: {
      status: { in: FILTER_STATUSES[filter] },
      ...(term
        ? {
            OR: [
              ...(asNumber !== null ? [{ requestNumber: asNumber }, { order: { orderNumber: asNumber } }] : []),
              { order: { user: { email: { contains: term, mode: 'insensitive' as const } } } },
              { items: { some: { orderItem: { productName: { contains: term, mode: 'insensitive' as const } } } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: filter === 'cerradas' || filter === 'todas' ? 'desc' : 'asc' },
    ...DETAIL,
  });
  return rows.map((r) => ({
    id: r.id,
    requestNumber: r.requestNumber,
    orderNumber: r.order.orderNumber,
    customerEmail: r.order.user.email,
    paymentProvider: r.order.paymentProvider,
    canRefundViaProvider: Boolean(r.order.paymentRef && (r.order.paymentProvider === 'WEBPAY' || r.order.paymentProvider === 'MERCADOPAGO')),
    type: r.type,
    resolution: r.resolution,
    status: r.status,
    reason: r.reason,
    sellerNote: r.sellerNote,
    restocked: r.restocked,
    refundCLP: r.refundCLP,
    amountCLP: r.items.reduce((a, it) => a + it.orderItem.unitPriceCLP * it.quantity, 0),
    items: r.items.map((it) => ({ name: it.orderItem.productName, quantity: it.quantity })),
    createdAt: r.createdAt,
  }));
}

export async function countReturnsByFilter(): Promise<Record<ReturnFilter, number>> {
  const grouped = await db.returnRequest.groupBy({ by: ['status'], _count: { _all: true } });
  const n = (statuses: ReturnStatus[]) => grouped.filter((g) => statuses.includes(g.status)).reduce((a, g) => a + g._count._all, 0);
  return {
    pendientes: n(FILTER_STATUSES.pendientes),
    'en-curso': n(FILTER_STATUSES['en-curso']),
    cerradas: n(FILTER_STATUSES.cerradas),
    todas: n(FILTER_STATUSES.todas),
  };
}

/** Solicitudes del cliente, por pedido (para "Mis pedidos"). */
export async function getClientReturns(userId: string) {
  const rows = await db.returnRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      orderId: true,
      requestNumber: true,
      type: true,
      resolution: true,
      status: true,
      sellerNote: true,
      refundCLP: true,
      createdAt: true,
      items: { select: { quantity: true } },
    },
  });
  const byOrder = new Map<string, typeof rows>();
  for (const r of rows) byOrder.set(r.orderId, [...(byOrder.get(r.orderId) ?? []), r]);
  return byOrder;
}
