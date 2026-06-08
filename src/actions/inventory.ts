'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/src/lib/auth/session';
import { adjustStock } from '@/src/lib/services/inventory.service';
import {
  createProduct,
  updateProduct,
  createCategory,
  updateCategory,
} from '@/src/lib/services/catalog.service';
import { db } from '@/src/lib/db';

// ─── Stock adjustment ────────────────────────────────────────

const AdjustStockSchema = z.object({
  productId: z.string().cuid(),
  newStock: z.number().int().min(0).max(99999),
  reason: z.enum([
    'RESTOCK',
    'CORRECTION_UP',
    'CORRECTION_DOWN',
    'DAMAGED',
    'EXPIRED',
    'RETURNED',
    'INITIAL_LOAD',
  ]),
  notes: z.string().max(500).optional(),
});

type AdjustStockInput = z.infer<typeof AdjustStockSchema>;

export async function adjustStockAction(
  input: AdjustStockInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || !['SELLER', 'ADMIN'].includes(session.role)) {
    return { ok: false, error: 'Sin permisos' };
  }

  const parsed = AdjustStockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  try {
    await adjustStock({ ...parsed.data, actorId: session.sub });
    revalidatePath('/trastienda/inventario');
    revalidatePath('/trastienda');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al ajustar stock' };
  }
}

// ─── Products ────────────────────────────────────────────────

const ProductActionSchema = z.object({
  sku: z.string().min(1).max(50),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  nameKorean: z.string().max(200).optional(),
  description: z.string().min(1).max(5000),
  priceCLP: z.number().int().positive(),
  costCLP: z.number().int().positive().optional(),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  weightGrams: z.number().int().positive(),
  images: z.array(z.string()).max(10).default([]),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  categoryId: z.string().cuid(),
});

type ProductActionInput = z.infer<typeof ProductActionSchema>;

export async function createProductAction(
  input: ProductActionInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || !['SELLER', 'ADMIN'].includes(session.role)) {
    return { ok: false, error: 'Sin permisos' };
  }

  const parsed = ProductActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' };

  try {
    const product = await createProduct(parsed.data);
    revalidatePath('/trastienda/productos');
    revalidatePath('/trastienda/inventario');
    return { ok: true, id: product.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al crear producto' };
  }
}

const UpdateProductSchema = ProductActionSchema.partial().extend({
  id: z.string().cuid(),
});

export async function updateProductAction(
  input: z.infer<typeof UpdateProductSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || !['SELLER', 'ADMIN'].includes(session.role)) {
    return { ok: false, error: 'Sin permisos' };
  }

  const parsed = UpdateProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' };

  const { id, ...data } = parsed.data;

  try {
    await updateProduct(id, data);
    revalidatePath('/trastienda/productos');
    revalidatePath(`/trastienda/productos/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al actualizar producto' };
  }
}

export async function archiveProductAction(
  productId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || !['SELLER', 'ADMIN'].includes(session.role)) {
    return { ok: false, error: 'Sin permisos' };
  }

  try {
    await db.product.update({
      where: { id: productId },
      data: { archivedAt: new Date(), active: false },
    });
    revalidatePath('/trastienda/productos');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al archivar producto' };
  }
}

export async function restoreProductAction(
  productId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || !['SELLER', 'ADMIN'].includes(session.role)) {
    return { ok: false, error: 'Sin permisos' };
  }

  try {
    await db.product.update({
      where: { id: productId },
      data: { archivedAt: null, active: true },
    });
    revalidatePath('/trastienda/productos');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al restaurar producto' };
  }
}

// ─── Categories ──────────────────────────────────────────────

const CategoryActionSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  active: z.boolean().default(true),
  order: z.number().int().default(0),
});

export async function createCategoryAction(
  input: z.infer<typeof CategoryActionSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || !['SELLER', 'ADMIN'].includes(session.role)) {
    return { ok: false, error: 'Sin permisos' };
  }

  const parsed = CategoryActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' };

  try {
    const cat = await createCategory(parsed.data);
    revalidatePath('/trastienda/categorias');
    return { ok: true, id: cat.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al crear categoría' };
  }
}

const UpdateCategorySchema = CategoryActionSchema.partial().extend({
  id: z.string().cuid(),
});

export async function updateCategoryAction(
  input: z.infer<typeof UpdateCategorySchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || !['SELLER', 'ADMIN'].includes(session.role)) {
    return { ok: false, error: 'Sin permisos' };
  }

  const parsed = UpdateCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' };

  const { id, ...data } = parsed.data;

  try {
    await updateCategory(id, data);
    revalidatePath('/trastienda/categorias');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al actualizar categoría' };
  }
}

export async function archiveCategoryAction(
  categoryId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || !['SELLER', 'ADMIN'].includes(session.role)) {
    return { ok: false, error: 'Sin permisos' };
  }

  try {
    await db.category.update({
      where: { id: categoryId },
      data: { archivedAt: new Date(), active: false },
    });
    revalidatePath('/trastienda/categorias');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al archivar categoría' };
  }
}
