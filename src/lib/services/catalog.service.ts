import { db } from '@/src/lib/db';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { fetchPage } from '@/src/lib/panel-list';
import type { CategorySchema, ProductSchema } from '@/src/lib/validation/schemas';

// ─── Categories ───────────────────────────────────────────

export async function getCategories(activeOnly = true) {
  return db.category.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });
}

export async function listCategoriesForPanel(opts: {
  q: string;
  archived: boolean;
  page: number;
  perPage: number;
}) {
  const where: Prisma.CategoryWhereInput = {
    archivedAt: opts.archived ? { not: null } : null,
    ...(opts.q
      ? {
          OR: [
            { name: { contains: opts.q, mode: 'insensitive' } },
            { slug: { contains: opts.q, mode: 'insensitive' } },
            { description: { contains: opts.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  return fetchPage(
    opts.page,
    opts.perPage,
    () => db.category.count({ where }),
    (skip, take) =>
      db.category.findMany({
        where,
        include: { _count: { select: { products: { where: { archivedAt: null } } } } },
        orderBy: [{ order: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
  );
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

export async function archiveCategory(id: string) {
  return db.category.update({
    where: { id },
    data: { archivedAt: new Date(), active: false },
  });
}

export async function restoreCategory(id: string) {
  return db.category.update({
    where: { id },
    data: { archivedAt: null, active: true },
  });
}

export async function deleteCategory(id: string) {
  const hasProducts = await db.product.count({ where: { categoryId: id, active: true } });
  if (hasProducts > 0) {
    throw new Error('No se puede eliminar una categoría con productos activos');
  }
  return db.category.delete({ where: { id } });
}

// ─── Products ─────────────────────────────────────────────

export type ProductSort = 'recent' | 'price-asc' | 'price-desc';

export interface ProductFilters {
  categorySlug?: string;
  featured?: boolean;
  search?: string;
  activeOnly?: boolean;
  inStockOnly?: boolean;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

const SORT_ORDER: Record<ProductSort, { createdAt: 'desc' } | { priceCLP: 'asc' | 'desc' }> = {
  recent: { createdAt: 'desc' },
  'price-asc': { priceCLP: 'asc' },
  'price-desc': { priceCLP: 'desc' },
};

export async function getProducts(filters: ProductFilters = {}) {
  const {
    categorySlug,
    featured,
    search,
    activeOnly = true,
    inStockOnly = false,
    sort = 'recent',
    page = 1,
    limit = 24,
  } = filters;

  const where = {
    active: activeOnly ? true : undefined,
    archivedAt: activeOnly ? null : undefined,
    featured: featured ?? undefined,
    stock: inStockOnly ? { gt: 0 } : undefined,
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
      orderBy: SORT_ORDER[sort],
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

// Listado completo para la trastienda — incluye archivados e inactivos
export type PanelProductStatus = 'activos' | 'archivados';
export type PanelProductSort = 'recientes' | 'nombre' | 'precio-asc' | 'precio-desc' | 'stock-asc';

// El id al final desempata: sin él, dos productos con el mismo precio podrían
// saltar de una página a otra entre consultas.
const PANEL_PRODUCT_ORDER: Record<PanelProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  recientes: [{ createdAt: 'desc' }, { id: 'asc' }],
  nombre: [{ name: 'asc' }, { id: 'asc' }],
  'precio-asc': [{ priceCLP: 'asc' }, { name: 'asc' }, { id: 'asc' }],
  'precio-desc': [{ priceCLP: 'desc' }, { name: 'asc' }, { id: 'asc' }],
  'stock-asc': [{ stock: 'asc' }, { name: 'asc' }, { id: 'asc' }],
};

/** Búsqueda por nombre (también en coreano) o SKU, sin distinguir mayúsculas. */
export function productSearchWhere(q: string): Prisma.ProductWhereInput {
  if (!q) return {};
  return {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { nameKorean: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
    ],
  };
}

export async function listProductsForPanel(opts: {
  q: string;
  categoryId?: string;
  status: PanelProductStatus;
  sort: PanelProductSort;
  page: number;
  perPage: number;
}) {
  const where: Prisma.ProductWhereInput = {
    ...productSearchWhere(opts.q),
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    archivedAt: opts.status === 'archivados' ? { not: null } : null,
  };
  return fetchPage(
    opts.page,
    opts.perPage,
    () => db.product.count({ where }),
    (skip, take) =>
      db.product.findMany({
        where,
        include: { category: { select: { name: true } } },
        orderBy: PANEL_PRODUCT_ORDER[opts.sort],
        skip,
        take,
      }),
  );
}

export async function getProductSummary(id: string) {
  return db.product.findUnique({
    where: { id },
    select: { name: true, sku: true, stock: true },
  });
}

export async function archiveProduct(id: string) {
  return db.product.update({
    where: { id },
    data: { archivedAt: new Date(), active: false },
  });
}

export async function restoreProduct(id: string) {
  return db.product.update({
    where: { id },
    data: { archivedAt: null, active: true },
  });
}

export async function createProduct(input: z.infer<typeof ProductSchema>) {
  return db.product.create({ data: input, include: { category: true } });
}

export async function updateProduct(
  id: string,
  input: Partial<z.infer<typeof ProductSchema>>,
  actorId?: string,
) {
  // Si cambia el precio, se registra en PriceHistory (auditoría + elasticidad).
  const current =
    input.priceCLP !== undefined
      ? await db.product.findUnique({ where: { id }, select: { priceCLP: true } })
      : null;

  const updated = await db.product.update({ where: { id }, data: input, include: { category: true } });

  if (current && input.priceCLP !== undefined && current.priceCLP !== input.priceCLP) {
    await db.priceHistory.create({
      data: { productId: id, previousCLP: current.priceCLP, newCLP: input.priceCLP, actorId },
    });
  }
  return updated;
}

export async function getPriceHistory(productId: string) {
  return db.priceHistory.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
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
