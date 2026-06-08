import { db } from '@/src/lib/db';
import type { z } from 'zod';
import type { CategorySchema, ProductSchema } from '@/src/lib/validation/schemas';

// ─── Categories ───────────────────────────────────────────

export async function getCategories(activeOnly = true) {
  return db.category.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });
}

export async function getCategoryBySlug(slug: string) {
  return db.category.findUnique({ where: { slug } });
}

export async function createCategory(input: z.infer<typeof CategorySchema>) {
  return db.category.create({ data: input });
}

export async function updateCategory(id: string, input: Partial<z.infer<typeof CategorySchema>>) {
  return db.category.update({ where: { id }, data: input });
}

export async function deleteCategory(id: string) {
  const hasProducts = await db.product.count({ where: { categoryId: id, active: true } });
  if (hasProducts > 0) {
    throw new Error('No se puede eliminar una categoría con productos activos');
  }
  return db.category.delete({ where: { id } });
}

// ─── Products ─────────────────────────────────────────────

export interface ProductFilters {
  categorySlug?: string;
  featured?: boolean;
  search?: string;
  activeOnly?: boolean;
  page?: number;
  limit?: number;
}

export async function getProducts(filters: ProductFilters = {}) {
  const { categorySlug, featured, search, activeOnly = true, page = 1, limit = 24 } = filters;

  const where = {
    active: activeOnly ? true : undefined,
    archivedAt: activeOnly ? null : undefined,
    featured: featured ?? undefined,
    category: categorySlug ? { slug: categorySlug } : undefined,
    OR: search
      ? [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ]
      : undefined,
  };

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      include: { category: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.product.count({ where }),
  ]);

  return { products, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getProductBySlug(slug: string) {
  return db.product.findUnique({
    where: { slug },
    include: { category: { select: { name: true, slug: true } } },
  });
}

export async function getProductById(id: string) {
  return db.product.findUnique({
    where: { id },
    include: { category: { select: { name: true, slug: true } } },
  });
}

export async function createProduct(input: z.infer<typeof ProductSchema>) {
  return db.product.create({ data: input, include: { category: true } });
}

export async function updateProduct(id: string, input: Partial<z.infer<typeof ProductSchema>>) {
  return db.product.update({ where: { id }, data: input, include: { category: true } });
}

export async function decrementStock(productId: string, quantity: number): Promise<boolean> {
  const updated = await db.product.updateMany({
    where: { id: productId, stock: { gte: quantity } },
    data: { stock: { decrement: quantity } },
  });
  return updated.count > 0;
}

export async function incrementStock(productId: string, quantity: number) {
  return db.product.update({
    where: { id: productId },
    data: { stock: { increment: quantity } },
  });
}
