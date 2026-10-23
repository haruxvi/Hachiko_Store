import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { safeImageUrl } from '@/src/lib/image-url';
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

// Altas y cambios del catálogo, compartidos por el panel web (server actions,
// sesión por cookie) y la API v1 de la app (token Bearer): mismas validaciones,
// mismos mensajes y misma revalidación de páginas. Quien llama ya verificó que
// la sesión es de un vendedor.

export type AdminResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Identificador de la BD: la mayoría son cuid, pero el catálogo sintético se
// sembró con UUID (seed-synthetic usa randomUUID). Aceptamos cualquier id acotado
// en vez de exigir formato cuid, para no romper la edición ni el ajuste de stock
// de esos productos. Si el id no existe, Prisma falla igual más abajo.
export const idSchema = z.string().min(1).max(64);

// Traduce errores conocidos de Prisma a mensajes claros para el vendedor, en vez
// de mostrar el texto crudo ("Unique constraint failed on the fields: (slug)").
export function friendlyDbError(e: unknown, fallback: string): string {
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
    if (code === 'P2003') return 'La categoría elegida no existe.';
  }
  // Otros errores de Prisma traen detalles internos (tablas, consultas): no salen.
  const internal = e instanceof Error && (e.constructor?.name ?? '').startsWith('Prisma');
  return e instanceof Error && !internal ? e.message : fallback;
}

// ─── Products ────────────────────────────────────────────────

// Se muestran a todos los clientes: solo https (misma regla que la carga masiva).
const imageList = z
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
  .max(10);

const productFields = {
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
  lowStockThreshold: z.number().int().min(0),
  weightGrams: z.number().int().positive(),
  images: imageList,
  active: z.boolean(),
  featured: z.boolean(),
  categoryId: idSchema,
};

export const ProductActionSchema = z.object({
  ...productFields,
  lowStockThreshold: productFields.lowStockThreshold.default(5),
  images: imageList.default([]),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
});

export const CreateProductSchema = ProductActionSchema.omit({ slug: true });

// Zod 4 aplica los .default() incluso dentro de .partial(): la edición se arma
// con los campos SIN valores por defecto, para que lo que no se envía quede como
// estaba (antes, editar sin mandar las fotos las borraba).
export const UpdateProductSchema = z.object(productFields).partial().extend({
  id: idSchema,
});

function productSlug(name: string) {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/, '') || 'producto';
  return `${base}-${randomUUID().slice(0, 8)}`;
}

function revalidateProducts(id?: string) {
  revalidatePath('/trastienda/productos');
  revalidatePath('/trastienda/inventario');
  if (id) revalidatePath(`/trastienda/productos/${id}`);
  revalidatePath('/catalogo');
}

export async function createProductAs(input: unknown): Promise<AdminResult<{ id: string }>> {
  const parsed = CreateProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  try {
    const product = await createProduct({ ...parsed.data, slug: productSlug(parsed.data.name) });
    revalidateProducts();
    return { ok: true, id: product.id };
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, 'Error al crear producto') };
  }
}

export async function updateProductAs(input: unknown, actorId: string): Promise<AdminResult> {
  const parsed = UpdateProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const { id, ...data } = parsed.data;

  try {
    await updateProduct(id, data, actorId);
    revalidateProducts(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, 'Error al actualizar producto') };
  }
}

export async function archiveProductAs(productId: unknown): Promise<AdminResult> {
  const id = idSchema.safeParse(productId);
  if (!id.success) return { ok: false, error: 'Producto inválido' };
  try {
    await archiveProduct(id.data);
    revalidateProducts(id.data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, 'Error al archivar producto') };
  }
}

export async function restoreProductAs(productId: unknown): Promise<AdminResult> {
  const id = idSchema.safeParse(productId);
  if (!id.success) return { ok: false, error: 'Producto inválido' };
  try {
    await restoreProduct(id.data);
    revalidateProducts(id.data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, 'Error al restaurar producto') };
  }
}

// ─── Categories ──────────────────────────────────────────────

const categoryFields = {
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  active: z.boolean(),
  order: z.number().int(),
};

export const CategoryActionSchema = z.object({
  ...categoryFields,
  active: z.boolean().default(true),
  order: z.number().int().default(0),
});

// Sin valores por defecto, por la misma razón que UpdateProductSchema.
export const UpdateCategorySchema = z.object(categoryFields).partial().extend({
  id: idSchema,
});

function revalidateCategories() {
  revalidatePath('/trastienda/categorias');
  revalidatePath('/catalogo');
}

export async function createCategoryAs(input: unknown): Promise<AdminResult<{ id: string }>> {
  const parsed = CategoryActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  try {
    const cat = await createCategory(parsed.data);
    revalidateCategories();
    return { ok: true, id: cat.id };
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, 'Error al crear categoría') };
  }
}

export async function updateCategoryAs(input: unknown): Promise<AdminResult> {
  const parsed = UpdateCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const { id, ...data } = parsed.data;

  try {
    await updateCategory(id, data);
    revalidateCategories();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, 'Error al actualizar categoría') };
  }
}

export async function archiveCategoryAs(categoryId: unknown): Promise<AdminResult> {
  const id = idSchema.safeParse(categoryId);
  if (!id.success) return { ok: false, error: 'Categoría inválida' };

  try {
    await archiveCategory(id.data);
    revalidateCategories();
    return { ok: true };
  } catch (e) {
    // No se muestra el error crudo de la base de datos al usuario.
    return { ok: false, error: friendlyDbError(e, 'No se pudo archivar la categoría') };
  }
}

export async function restoreCategoryAs(categoryId: unknown): Promise<AdminResult> {
  const id = idSchema.safeParse(categoryId);
  if (!id.success) return { ok: false, error: 'Categoría inválida' };

  try {
    await restoreCategory(id.data);
    revalidateCategories();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, 'No se pudo restaurar la categoría') };
  }
}
