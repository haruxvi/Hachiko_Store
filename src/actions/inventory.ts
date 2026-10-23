'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/src/lib/auth/session';
import { adjustStock } from '@/src/lib/services/inventory.service';
import {
  archiveCategoryAs,
  archiveProductAs,
  createCategoryAs,
  createProductAs,
  idSchema,
  restoreCategoryAs,
  restoreProductAs,
  updateCategoryAs,
  updateProductAs,
  type CategoryActionSchema,
  type CreateProductSchema,
  type UpdateCategorySchema,
  type UpdateProductSchema,
} from '@/src/lib/catalog-admin';

// Las reglas de productos y categorías viven en src/lib/catalog-admin.ts (las
// comparte la API de la app); aquí solo se verifica la sesión del panel web.

async function isSeller() {
  const session = await getSession();
  return session?.role === 'SELLER' ? session : null;
}

const FORBIDDEN = { ok: false as const, error: 'Sin permisos' };

// ─── Stock adjustment ────────────────────────────────────────

const AdjustStockSchema = z.object({
  productId: idSchema,
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
  if (!session || session.role !== 'SELLER') {
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

export async function createProductAction(
  input: z.input<typeof CreateProductSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!(await isSeller())) return FORBIDDEN;
  return createProductAs(input);
}

export async function updateProductAction(
  input: z.input<typeof UpdateProductSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await isSeller();
  if (!session) return FORBIDDEN;
  return updateProductAs(input, session.sub);
}

export async function archiveProductAction(
  productId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isSeller())) return FORBIDDEN;
  return archiveProductAs(productId);
}

export async function restoreProductAction(
  productId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isSeller())) return FORBIDDEN;
  return restoreProductAs(productId);
}

// ─── Categories ──────────────────────────────────────────────

export async function createCategoryAction(
  input: z.input<typeof CategoryActionSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!(await isSeller())) return FORBIDDEN;
  return createCategoryAs(input);
}

export async function updateCategoryAction(
  input: z.input<typeof UpdateCategorySchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isSeller())) return FORBIDDEN;
  return updateCategoryAs(input);
}

export async function archiveCategoryAction(
  categoryId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isSeller())) return FORBIDDEN;
  return archiveCategoryAs(categoryId);
}

export async function restoreCategoryAction(
  categoryId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isSeller())) return FORBIDDEN;
  return restoreCategoryAs(categoryId);
}
