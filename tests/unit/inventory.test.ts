import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InsufficientStockError } from '@/src/lib/services/inventory.service';

// Mock the db module
vi.mock('@/src/lib/db', () => ({
  db: {
    $transaction: vi.fn(),
    stockReservation: {
      deleteMany: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    product: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    stockMovement: { create: vi.fn() },
    stockAdjustment: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

// Mock next/cache
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

import { db } from '@/src/lib/db';
import {
  reserveStock,
  confirmStockDeduction,
  releaseReservation,
  adjustStock,
  cleanExpiredReservations,
} from '@/src/lib/services/inventory.service';

const mockDb = db as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  stockReservation: {
    deleteMany: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  product: {
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  stockMovement: { create: ReturnType<typeof vi.fn> };
  stockAdjustment: { create: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: $transaction calls the callback with the same db interface
  mockDb.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => {
    return fn(db);
  });
});

describe('InsufficientStockError', () => {
  it('exposes productId, requested, available', () => {
    const err = new InsufficientStockError('prod-1', 5, 2);
    expect(err.productId).toBe('prod-1');
    expect(err.requested).toBe(5);
    expect(err.available).toBe(2);
    expect(err.name).toBe('InsufficientStockError');
  });
});

describe('reserveStock', () => {
  it('reserva stock si hay disponible', async () => {
    mockDb.product.findUniqueOrThrow.mockResolvedValue({
      id: 'prod-1',
      stock: 10,
      name: 'Test',
      active: true,
      archivedAt: null,
    });
    mockDb.stockReservation.aggregate.mockResolvedValue({ _sum: { quantity: 2 } });

    const upsertMock = vi.fn().mockResolvedValue({});
    (db as unknown as { stockReservation: { upsert: typeof upsertMock } }).stockReservation.upsert =
      upsertMock;

    await expect(
      reserveStock('order-1', [{ productId: 'prod-1', quantity: 5 }]),
    ).resolves.not.toThrow();
  });

  it('falla con InsufficientStockError si no hay disponible', async () => {
    mockDb.product.findUniqueOrThrow.mockResolvedValue({
      id: 'prod-1',
      stock: 3,
      name: 'Test',
      active: true,
      archivedAt: null,
    });
    mockDb.stockReservation.aggregate.mockResolvedValue({ _sum: { quantity: 2 } });

    // Available = 3 - 2 = 1, requested = 5
    await expect(
      reserveStock('order-1', [{ productId: 'prod-1', quantity: 5 }]),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it('rechaza producto archivado', async () => {
    mockDb.product.findUniqueOrThrow.mockResolvedValue({
      id: 'prod-1',
      stock: 10,
      name: 'Test',
      active: true,
      archivedAt: new Date(),
    });

    await expect(
      reserveStock('order-1', [{ productId: 'prod-1', quantity: 1 }]),
    ).rejects.toThrow('no está disponible');
  });
});

describe('confirmStockDeduction', () => {
  it('descuenta stock real al confirmar y elimina reservas', async () => {
    mockDb.stockReservation.findMany.mockResolvedValue([
      { product: { id: 'prod-1', stock: 10 }, quantity: 3 },
    ]);

    await confirmStockDeduction('order-1', null);

    expect(mockDb.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { stock: 7 },
      }),
    );
    expect(mockDb.stockMovement.create).toHaveBeenCalled();
    expect(mockDb.stockReservation.deleteMany).toHaveBeenCalledWith({ where: { orderId: 'order-1' } });
  });

  it('lanza error si no hay reservas', async () => {
    mockDb.stockReservation.findMany.mockResolvedValue([]);
    await expect(confirmStockDeduction('order-999', null)).rejects.toThrow('No hay reservas');
  });

  it('lanza error si resultingStock sería negativo', async () => {
    mockDb.stockReservation.findMany.mockResolvedValue([
      { product: { id: 'prod-1', stock: 2 }, quantity: 5 },
    ]);
    await expect(confirmStockDeduction('order-1', null)).rejects.toThrow('Stock negativo');
  });
});

describe('releaseReservation', () => {
  it('libera reserva al fallar pago', async () => {
    mockDb.stockReservation.deleteMany.mockResolvedValue({ count: 2 });
    await releaseReservation('order-1');
    expect(mockDb.stockReservation.deleteMany).toHaveBeenCalledWith({ where: { orderId: 'order-1' } });
  });
});

describe('adjustStock', () => {
  beforeEach(() => {
    mockDb.product.findUniqueOrThrow.mockResolvedValue({ stock: 10 });
    mockDb.stockReservation.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
    mockDb.stockAdjustment.create.mockResolvedValue({ id: 'adj-1' });
  });

  it('rechaza ajuste a negativo', async () => {
    await expect(
      adjustStock({ productId: 'p-1', newStock: -1, reason: 'DAMAGED', actorId: 'u-1' }),
    ).rejects.toThrow('no puede ser negativo');
  });

  it('exige notes en CORRECTION_UP', async () => {
    await expect(
      adjustStock({ productId: 'p-1', newStock: 15, reason: 'CORRECTION_UP', actorId: 'u-1' }),
    ).rejects.toThrow('requieren motivo escrito');
  });

  it('exige notes en CORRECTION_DOWN', async () => {
    await expect(
      adjustStock({ productId: 'p-1', newStock: 5, reason: 'CORRECTION_DOWN', actorId: 'u-1' }),
    ).rejects.toThrow('requieren motivo escrito');
  });

  it('rechaza ajuste que dejaría disponible < 0 considerando reservas activas', async () => {
    mockDb.stockReservation.aggregate.mockResolvedValue({ _sum: { quantity: 8 } });
    // newStock = 3, reservadas = 8 → disponible = -5
    await expect(
      adjustStock({ productId: 'p-1', newStock: 3, reason: 'DAMAGED', actorId: 'u-1' }),
    ).rejects.toThrow('hay 8 unidades reservadas');
  });

  it('registra StockMovement en cada operación', async () => {
    await adjustStock({
      productId: 'p-1',
      newStock: 20,
      reason: 'RESTOCK',
      actorId: 'u-1',
    });
    expect(mockDb.stockMovement.create).toHaveBeenCalled();
    expect(mockDb.stockAdjustment.create).toHaveBeenCalled();
  });

  it('devuelve changed: false si el stock no cambió', async () => {
    mockDb.product.findUniqueOrThrow.mockResolvedValue({ stock: 10 });
    const result = await adjustStock({
      productId: 'p-1',
      newStock: 10,
      reason: 'RESTOCK',
      actorId: 'u-1',
    });
    expect(result).toEqual({ changed: false });
    expect(mockDb.product.update).not.toHaveBeenCalled();
  });
});

describe('cleanExpiredReservations', () => {
  it('elimina reservas expiradas y retorna el conteo', async () => {
    mockDb.stockReservation.deleteMany.mockResolvedValue({ count: 3 });
    const result = await cleanExpiredReservations();
    expect(result).toEqual({ cleaned: 3 });
  });
});
