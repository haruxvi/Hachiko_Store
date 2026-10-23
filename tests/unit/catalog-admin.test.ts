import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/src/lib/services/catalog.service', () => ({
  createProduct: mocks.createProduct,
  updateProduct: mocks.updateProduct,
  archiveProduct: vi.fn(),
  restoreProduct: vi.fn(),
  createCategory: mocks.createCategory,
  updateCategory: mocks.updateCategory,
  archiveCategory: vi.fn(),
  restoreCategory: vi.fn(),
}));

import { createCategoryAs, createProductAs, updateCategoryAs, updateProductAs } from '@/src/lib/catalog-admin';

const product = {
  sku: 'TEST-1',
  name: 'Gomitas Shiba',
  description: 'De prueba',
  priceCLP: 2990,
  stock: 10,
  weightGrams: 150,
  categoryId: 'clh12345678901234567890123',
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createProduct.mockResolvedValue({ id: 'p1' });
  mocks.createCategory.mockResolvedValue({ id: 'c1' });
});

describe('Altas y cambios del catálogo (panel web y app)', () => {
  it('al crear, completa los valores por defecto', async () => {
    expect(await createProductAs(product)).toEqual({ ok: true, id: 'p1' });
    const data = mocks.createProduct.mock.calls[0]![0];
    expect(data).toMatchObject({ images: [], active: true, featured: false, lowStockThreshold: 5 });
    expect(data.slug).toMatch(/^gomitas-shiba-[0-9a-f]{8}$/);
  });

  it('editar solo el precio no toca fotos, visibilidad, destacado ni umbral', async () => {
    expect(await updateProductAs({ id: 'p1', priceCLP: 3290 }, 'seller')).toEqual({ ok: true });
    expect(mocks.updateProduct).toHaveBeenCalledWith('p1', { priceCLP: 3290 }, 'seller');
  });

  it('editar una categoría sin mandar "activa" ni "orden" los deja como estaban', async () => {
    expect(await updateCategoryAs({ id: 'c1', name: 'Dulces' })).toEqual({ ok: true });
    expect(mocks.updateCategory).toHaveBeenCalledWith('c1', { name: 'Dulces' });
  });

  it('al crear una categoría, queda visible y al inicio', async () => {
    await createCategoryAs({ name: 'Dulces', slug: 'dulces' });
    expect(mocks.createCategory).toHaveBeenCalledWith({ name: 'Dulces', slug: 'dulces', active: true, order: 0 });
  });

  it('rechaza fotos que no son https', async () => {
    const r = await updateProductAs({ id: 'p1', images: ['http://inseguro.cl/a.png'] }, 'seller');
    expect(r).toEqual({ ok: false, error: 'Las imágenes deben ser URLs https.' });
    expect(mocks.updateProduct).not.toHaveBeenCalled();
  });

  it('traduce el SKU repetido a un mensaje para el vendedor', async () => {
    mocks.createProduct.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target: ['sku'] } }));
    expect(await createProductAs(product)).toEqual({ ok: false, error: 'Ya existe otro producto con ese SKU. Cambia el SKU.' });
  });

  it('no deja salir detalles internos de otros errores de Prisma', async () => {
    class PrismaClientValidationError extends Error {}
    mocks.updateProduct.mockRejectedValue(new PrismaClientValidationError('Invalid `prisma.product.update()` invocation: tabla Product…'));
    expect(await updateProductAs({ id: 'p1', priceCLP: 1000 }, 'seller')).toEqual({ ok: false, error: 'Error al actualizar producto' });
  });
});
