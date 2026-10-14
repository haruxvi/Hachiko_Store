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
      groupBy: vi.fn(),
    },
    product: {
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
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
  withSerializableRetry,
  deductStockForOrder,
  adjustStock,
  cleanExpiredReservations,
  MAX_RETRIES,
  type Tx,
} from '@/src/lib/services/inventory.service';

const mockDb = db as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  stockReservation: {
    deleteMany: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
  product: {
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  stockMovement: { create: ReturnType<typeof vi.fn> };
  stockAdjustment: { create: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const runInline = async (fn: (tx: typeof db) => Promise<unknown>) => fn(db);

beforeEach(() => {
  vi.resetAllMocks();
  // Default: $transaction calls the callback with the same db interface
  mockDb.$transaction.mockImplementation(runInline);
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

describe('withSerializableRetry', () => {
  const conflict = () => Object.assign(new Error('write conflict'), { code: 'P2034' });

  it('reintenta cuando Postgres aborta por conflicto de serialización (P2034)', async () => {
    mockDb.$transaction.mockRejectedValueOnce(conflict()).mockImplementationOnce(runInline);
    await expect(withSerializableRetry(async () => 'ok')).resolves.toBe('ok');
    expect(mockDb.$transaction).toHaveBeenCalledTimes(2);
  });

  it('no reintenta errores de negocio', async () => {
    mockDb.$transaction.mockRejectedValueOnce(new Error('Stock insuficiente'));
    await expect(withSerializableRetry(async () => 'ok')).rejects.toThrow('Stock insuficiente');
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
  });

  it('se rinde tras el máximo de reintentos', async () => {
    mockDb.$transaction.mockRejectedValue(conflict());
    await expect(withSerializableRetry(async () => 'ok')).rejects.toThrow('write conflict');
    expect(mockDb.$transaction).toHaveBeenCalledTimes(MAX_RETRIES);
  });
});

describe('deductStockForOrder', () => {
  const tx = db as unknown as Tx;

  it('descuenta stock, registra el movimiento (negativo) y elimina las reservas del pedido', async () => {
    mockDb.product.findMany.mockResolvedValue([{ id: 'prod-1', stock: 10 }]);
    mockDb.stockReservation.groupBy.mockResolvedValue([]);

    await deductStockForOrder(tx, 'order-1', [{ productId: 'prod-1', quantity: 3 }]);

    expect(mockDb.product.update).toHaveBeenCalledWith({ where: { id: 'prod-1' }, data: { stock: 7 } });
    expect(mockDb.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'OUT', reason: 'SALE', quantity: -3, previousStock: 10, resultingStock: 7 }),
    });
    expect(mockDb.stockReservation.deleteMany).toHaveBeenCalledWith({ where: { orderId: 'order-1' } });
  });

  it('funciona aunque la reserva del pedido ya haya vencido o se haya limpiado', async () => {
    mockDb.product.findMany.mockResolvedValue([{ id: 'prod-1', stock: 2 }]);
    mockDb.stockReservation.groupBy.mockResolvedValue([]);
    await expect(
      deductStockForOrder(tx, 'order-1', [{ productId: 'prod-1', quantity: 2 }]),
    ).resolves.toEqual(['prod-1']);
  });

  it('respeta las reservas vigentes de OTROS pedidos', async () => {
    mockDb.product.findMany.mockResolvedValue([{ id: 'prod-1', stock: 3 }]);
    mockDb.stockReservation.groupBy.mockResolvedValue([{ productId: 'prod-1', _sum: { quantity: 2 } }]);
    await expect(
      deductStockForOrder(tx, 'order-1', [{ productId: 'prod-1', quantity: 2 }]),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it('valida todas las líneas antes de escribir: sin descuentos parciales', async () => {
    mockDb.product.findMany.mockResolvedValue([
      { id: 'prod-1', stock: 10 },
      { id: 'prod-2', stock: 0 },
    ]);
    mockDb.stockReservation.groupBy.mockResolvedValue([]);
    await expect(
      deductStockForOrder(tx, 'order-1', [
        { productId: 'prod-1', quantity: 1 },
        { productId: 'prod-2', quantity: 1 },
      ]),
    ).rejects.toBeInstanceOf(InsufficientStockError);
    expect(mockDb.product.update).not.toHaveBeenCalled();
    expect(mockDb.stockMovement.create).not.toHaveBeenCalled();
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
