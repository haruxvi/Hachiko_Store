import { db } from '@/src/lib/db';
import { addMinutes } from 'date-fns';
import { revalidateTag } from 'next/cache';

const RESERVATION_TTL_MIN = Number(process.env['RESERVATION_TTL_MINUTES'] ?? 15);
const MAX_RETRIES = 3;

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

type ReservationItem = { productId: string; quantity: number };

export async function reserveStock(orderId: string, items: ReservationItem[]) {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      return await db.$transaction(
        async (tx) => {
          for (const item of items) {
            const product = await tx.product.findUniqueOrThrow({
              where: { id: item.productId },
              select: { id: true, stock: true, name: true, active: true, archivedAt: true },
            });

            if (!product.active || product.archivedAt) {
              throw new Error(`Producto ${product.name} no está disponible`);
            }

            const reserved = await tx.stockReservation.aggregate({
              where: {
                productId: item.productId,
                expiresAt: { gt: new Date() },
                orderId: { not: orderId },
              },
              _sum: { quantity: true },
            });

            const available = product.stock - (reserved._sum.quantity ?? 0);

            if (available < item.quantity) {
              throw new InsufficientStockError(item.productId, item.quantity, available);
            }

            await tx.stockReservation.upsert({
              where: { orderId_productId: { orderId, productId: item.productId } },
              create: {
                productId: item.productId,
                orderId,
                quantity: item.quantity,
                expiresAt: addMinutes(new Date(), RESERVATION_TTL_MIN),
              },
              update: {
                quantity: item.quantity,
                expiresAt: addMinutes(new Date(), RESERVATION_TTL_MIN),
              },
            });
          }
        },
        { isolationLevel: 'Serializable', maxWait: 5000, timeout: 10000 },
      );
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'P2034' || e.message?.includes('40001')) {
        attempt++;
        await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
        continue;
      }
      throw err;
    }
  }

  throw new Error('No se pudo reservar stock tras múltiples reintentos');
}

export async function confirmStockDeduction(
  orderId: string,
  actorId: string | null = null,
) {
  await db.$transaction(
    async (tx) => {
      const reservations = await tx.stockReservation.findMany({
        where: { orderId },
        include: { product: { select: { id: true, stock: true } } },
      });

      if (reservations.length === 0) {
        throw new Error(`No hay reservas para orden ${orderId}`);
      }

      for (const res of reservations) {
        const previousStock = res.product.stock;
        const resultingStock = previousStock - res.quantity;

        if (resultingStock < 0) {
          throw new Error(`Stock negativo detectado para ${res.product.id}`);
        }

        await tx.product.update({
          where: { id: res.product.id },
          data: { stock: resultingStock },
        });

        await tx.stockMovement.create({
          data: {
            productId: res.product.id,
            type: 'OUT',
            reason: 'SALE',
            quantity: -res.quantity,
            previousStock,
            resultingStock,
            orderId,
            actorId,
          },
        });

        revalidateTag(`product:${res.product.id}`);
      }

      await tx.stockReservation.deleteMany({ where: { orderId } });

      revalidateTag('catalog');
      revalidateTag('inventory');
    },
    { isolationLevel: 'Serializable', maxWait: 5000, timeout: 10000 },
  );
}

export async function releaseReservation(orderId: string) {
  await db.stockReservation.deleteMany({ where: { orderId } });
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

  const result = await db.$transaction(
    async (tx) => {
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
    },
    { isolationLevel: 'Serializable' },
  );

  revalidateTag(`product:${input.productId}`);
  revalidateTag('inventory');

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
