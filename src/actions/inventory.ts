'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/src/lib/auth/session';
import { safeImageUrl } from '@/src/lib/image-url';
import { adjustStock } from '@/src/lib/services/inventory.service';
import {
  createProduct,
  updateProduct,
  archiveProduct,
  restoreProduct,
  createCategory,
  updateCategory,
  archiveCategory,
  restoreCategory,
} from '@/src/lib/services/catalog.service';

// Identificador de la BD: la mayoría son cuid, pero el catálogo sintético se
// sembró con UUID (seed-synthetic usa randomUUID). Aceptamos cualquier id acotado
// en vez de exigir formato cuid, para no romper la edición ni el ajuste de stock
// de esos productos. Si el id no existe, Prisma falla igual más abajo.
const idSchema = z.string().min(1).max(64);

// Traduce errores conocidos de Prisma a mensajes claros para el vendedor, en vez
// de mostrar el texto crudo ("Unique constraint failed on the fields: (slug)").
function friendlyDbError(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = (e as { code?: string }).code;
    if (code === 'P2002') {
      const target = (e as { meta?: { target?: string[] | string } }).meta?.target;
      const fields = Array.isArray(target) ? target.join(',') : String(target ?? '');
      if (fields.includes('slug')) return 'Ya existe otro registro con ese slug (URL). Cambia el slug.';
      if (fields.includes('sku')) return 'Ya existe otro producto con ese SKU. Cambia el SKU.';
      return 'Ese valor ya existe y debe ser único.';
    }
    if (code === 'P2025') return 'No se encontró el registro (puede haber sido eliminado).';
  }
  return e instanceof Error ? e.message : fallback;
}

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
  // Se muestran a todos los clientes: solo https (misma regla que la carga masiva).
  images: z
    .array(
      z.string().transform((v, ctx) => {
        const url = safeImageUrl(v);
        if (!url) {
          ctx.addIssue({ code: 'custom', message: 'Las imágenes deben ser URLs https.' });
          return z.NEVER;
        }
        return url;
      }),
    )
    .max(10)
    .default([]),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  categoryId: idSchema,
});

const CreateProductSchema = ProductActionSchema.omit({ slug: true });

function productSlug(name: string) {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/, '') || 'producto';
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export async function createProductAction(
  input: z.infer<typeof CreateProductSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') {
    return { ok: false, error: 'Sin permisos' };
  }

  const parsed = CreateProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  try {
    const product = await createProduct({ ...parsed.data, slug: productSlug(parsed.data.name) });
    revalidatePath('/trastienda/productos');
    revalidatePath('/trastienda/inventario');
    return { ok: true, id: product.id };
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, 'Error al crear producto') };
  }
}

const UpdateProductSchema = ProductActionSchema.partial().extend({
  id: idSchema,
});

export async function updateProductAction(
  input: z.infer<typeof UpdateProductSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') {
    return { ok: false, error: 'Sin permisos' };
  }

  const parsed = UpdateProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const { id, ...data } = parsed.data;

  try {
    await updateProduct(id, data, session.sub);
    revalidatePath('/trastienda/productos');
    revalidatePath(`/trastienda/productos/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, 'Error al actualizar producto') };
  }
}

export async function archiveProductAction(
  productId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') {
    return { ok: false, error: 'Sin permisos' };
  }

  try {
    await archiveProduct(productId);
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
  if (!session || session.role !== 'SELLER') {
    return { ok: false, error: 'Sin permisos' };
  }

  try {
    await restoreProduct(productId);
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
  if (!session || session.role !== 'SELLER') {
    return { ok: false, error: 'Sin permisos' };
  }

  const parsed = CategoryActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  try {
    const cat = await createCategory(parsed.data);
    revalidatePath('/trastienda/categorias');
    return { ok: true, id: cat.id };
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, 'Error al crear categoría') };
  }
}

const UpdateCategorySchema = CategoryActionSchema.partial().extend({
  id: idSchema,
});

export async function updateCategoryAction(
  input: z.infer<typeof UpdateCategorySchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') {
    return { ok: false, error: 'Sin permisos' };
  }

  const parsed = UpdateCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const { id, ...data } = parsed.data;

  try {
    await updateCategory(id, data);
    revalidatePath('/trastienda/categorias');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, 'Error al actualizar categoría') };
  }
}

export async function archiveCategoryAction(
  categoryId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') {
    return { ok: false, error: 'Sin permisos' };
  }

  const id = idSchema.safeParse(categoryId);
  if (!id.success) return { ok: false, error: 'Categoría inválida' };

  try {
    await archiveCategory(id.data);
    revalidatePath('/trastienda/categorias');
    revalidatePath('/catalogo');
    return { ok: true };
  } catch (e) {
    // No se muestra el error crudo de la base de datos al usuario.
    return { ok: false, error: friendlyDbError(e, 'No se pudo archivar la categoría') };
  }
}

export async function restoreCategoryAction(
  categoryId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') {
    return { ok: false, error: 'Sin permisos' };
  }
  const id = idSchema.safeParse(categoryId);
  if (!id.success) return { ok: false, error: 'Categoría inválida' };

  try {
    await restoreCategory(id.data);
    revalidatePath('/trastienda/categorias');
    revalidatePath('/catalogo');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, 'No se pudo restaurar la categoría') };
  }
}
