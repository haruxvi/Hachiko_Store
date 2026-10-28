import { db } from '@/src/lib/db';
import { revalidateTag } from 'next/cache';
import type { Prisma } from '@prisma/client';

// Next 16 cambió la firma a revalidateTag(tag, profile). Usamos { expire: 0 }
// (purgar de inmediato) en lugar de updateTag(): estas funciones también se
// ejecutan desde el webhook de pago (route handler), donde updateTag lanzaría
// (solo permitido en Server Actions).
const PURGE = { expire: 0 } as const;

// Con N transacciones compitiendo por la misma fila, la última puede necesitar
// hasta N intentos. 8 cubre ráfagas realistas de una pyme (verificado con 5
// pagos simultáneos en tests/integration); si aun así se agota, el error sube
// y la pasarela reintenta el webhook más tarde (es idempotente).
export const MAX_RETRIES = 8;

export class InsufficientStockError extends Error {
  constructor(
    public productId: string,
    public requested: number,
    public available: number,
  ) {
    super(
      `Stock insuficiente para ${productId}: pedido ${requested}, disponible ${available}`,
    );
    this.name = 'InsufficientStockError';
  }
}

export type Tx = Prisma.TransactionClient;

function isSerializationFailure(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === 'P2034' || (e?.message?.includes('40001') ?? false);
}

/**
 * Ejecuta `fn` en una transacción Serializable y la reintenta (con backoff
 * exponencial) si Postgres la aborta por conflicto de serialización. Es lo que
 * garantiza "sin sobreventa": si dos compras chocan por la última unidad,
 * Postgres aborta una, se reintenta, y en el reintento ya ve el stock real.
 */
export async function withSerializableRetry<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(fn, { isolationLevel: 'Serializable', maxWait: 5000, timeout: 10000 });
    } catch (err) {
      if (!isSerializationFailure(err) || attempt + 1 >= MAX_RETRIES) throw err;
      // Backoff exponencial con jitter (tope 1 s): evita que los reintentos vuelvan a chocar en sincronía.
      await new Promise((r) => setTimeout(r, Math.min(1000, 20 * 2 ** attempt) * (0.5 + Math.random())));
    }
  }
}

/** Unidades reservadas por pedidos vigentes, excluyendo opcionalmente uno. */
export async function activeReservations(
  tx: Tx,
  productIds: string[],
  excludeOrderId?: string,
): Promise<Map<string, number>> {
  const rows = await tx.stockReservation.groupBy({
    by: ['productId'],
    where: {
      productId: { in: productIds },
      expiresAt: { gt: new Date() },
      ...(excludeOrderId ? { orderId: { not: excludeOrderId } } : {}),
    },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.productId, r._sum.quantity ?? 0]));
}

type OrderLine = { productId: string; quantity: number };

/**
 * Descuenta el stock físico de un pedido pagado, DENTRO de la transacción del
 * pago (la llama payment.service). No depende de que la reserva siga viva: si
 * venció, igual se vende mientras haya unidades que no estén reservadas por
 * OTROS pedidos vigentes. Valida TODAS las líneas antes de escribir: si alguna
 * no alcanza, lanza InsufficientStockError sin haber tocado nada.
 */
export async function deductStockForOrder(
  tx: Tx,
  orderId: string,
  lines: OrderLine[],
  actorId: string | null = null,
): Promise<string[]> {
  const ids = lines.map((l) => l.productId);
  const [products, reservedByOthers] = await Promise.all([
    tx.product.findMany({ where: { id: { in: ids } }, select: { id: true, stock: true } }),
    activeReservations(tx, ids, orderId),
  ]);
  const stockById = new Map(products.map((p) => [p.id, p.stock]));

  for (const line of lines) {
    const available = (stockById.get(line.productId) ?? 0) - (reservedByOthers.get(line.productId) ?? 0);
    if (available < line.quantity) {
      throw new InsufficientStockError(line.productId, line.quantity, available);
    }
  }

  for (const line of lines) {
    const previousStock = stockById.get(line.productId) ?? 0;
    const resultingStock = previousStock - line.quantity;

    await tx.product.update({ where: { id: line.productId }, data: { stock: resultingStock } });
    await tx.stockMovement.create({
      data: {
        productId: line.productId,
        type: 'OUT',
        reason: 'SALE',
        quantity: -line.quantity,
        previousStock,
        resultingStock,
        orderId,
        actorId,
      },
    });
  }

  await tx.stockReservation.deleteMany({ where: { orderId } });
  return ids;
}

/** Purga el caché de catálogo e inventario tras mover stock (fuera de la transacción). */
export function revalidateStock(productIds: string[]) {
  for (const id of productIds) revalidateTag(`product:${id}`, PURGE);
  revalidateTag('catalog', PURGE);
  revalidateTag('inventory', PURGE);
}

type AdjustInput = {
  productId: string;
  newStock: number;
  reason:
    | 'RESTOCK'
    | 'CORRECTION_UP'
    | 'CORRECTION_DOWN'
    | 'DAMAGED'
    | 'EXPIRED'
    | 'RETURNED'
    | 'INITIAL_LOAD';
  notes?: string;
  actorId: string;
};

export async function adjustStock(input: AdjustInput) {
  if (input.newStock < 0) throw new Error('Stock no puede ser negativo');

  if (['CORRECTION_UP', 'CORRECTION_DOWN'].includes(input.reason) && !input.notes) {
    throw new Error('Las correcciones manuales requieren motivo escrito');
  }

  const result = await withSerializableRetry(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: input.productId },
      select: { stock: true },
    });

    const delta = input.newStock - product.stock;
    if (delta === 0) return { changed: false as const };

    if (delta < 0) {
      const reserved = await tx.stockReservation.aggregate({
        where: { productId: input.productId, expiresAt: { gt: new Date() } },
        _sum: { quantity: true },
      });
      const availableAfter = input.newStock - (reserved._sum.quantity ?? 0);
      if (availableAfter < 0) {
        throw new Error(
          `No puedes bajar a ${input.newStock}: hay ${reserved._sum.quantity} unidades reservadas en órdenes activas`,
        );
      }
    }

    await tx.product.update({
      where: { id: input.productId },
      data: { stock: input.newStock },
    });

    const adjustment = await tx.stockAdjustment.create({
      data: {
        productId: input.productId,
        previousStock: product.stock,
        newStock: input.newStock,
        delta,
        reason: input.reason,
        notes: input.notes,
        actorId: input.actorId,
      },
    });

    await tx.stockMovement.create({
      data: {
        productId: input.productId,
        type: delta > 0 ? 'IN' : 'OUT',
        reason: input.reason,
        quantity: delta,
        previousStock: product.stock,
        resultingStock: input.newStock,
        adjustmentId: adjustment.id,
        actorId: input.actorId,
        notes: input.notes,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: 'STOCK_ADJUST',
        targetType: 'Product',
        targetId: input.productId,
        metadata: {
          previousStock: product.stock,
          newStock: input.newStock,
          delta,
          reason: input.reason,
        },
      },
    });

    return { changed: true as const, adjustment };
  });

  revalidateTag(`product:${input.productId}`, PURGE);
  revalidateTag('inventory', PURGE);

  return result;
}

export async function cleanExpiredReservations() {
  const result = await db.stockReservation.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return { cleaned: result.count };
}

export async function getAvailableStock(productId: string): Promise<number> {
  const [product, reserved] = await Promise.all([
    db.product.findUniqueOrThrow({
      where: { id: productId },
      select: { stock: true },
    }),
    db.stockReservation.aggregate({
      where: { productId, expiresAt: { gt: new Date() } },
      _sum: { quantity: true },
    }),
  ]);

  return product.stock - (reserved._sum.quantity ?? 0);
}

export async function getAvailableStockBatch(
  productIds: string[],
): Promise<Map<string, number>> {
  const [products, reservations] = await Promise.all([
    db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, stock: true },
    }),
    db.stockReservation.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds }, expiresAt: { gt: new Date() } },
      _sum: { quantity: true },
    }),
  ]);

  const reservedMap = new Map(
    reservations.map((r) => [r.productId, r._sum.quantity ?? 0]),
  );
  return new Map(
    products.map((p) => [p.id, p.stock - (reservedMap.get(p.id) ?? 0)]),
  );
}

export async function getProductStockHistory(productId: string, days = 90) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return db.stockMovement.findMany({
    where: {
      productId,
      createdAt: { gte: since },
    },
    include: {
      adjustment: true,
      order: { select: { orderNumber: true, totalCLP: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
