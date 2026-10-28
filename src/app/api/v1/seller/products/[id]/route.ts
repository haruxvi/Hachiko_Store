import type { NextRequest } from 'next/server';
import { getProductById } from '@/src/lib/services/catalog.service';
import { updateProductAs } from '@/src/lib/catalog-admin';
import { publicImages, siteOrigin } from '@/src/lib/api/dto';
import { api, ApiError, jsonBody, limit, ok, options, requireSession, routeId, settled } from '@/src/lib/api/v1';

export { options as OPTIONS };

const NOT_FOUND = 'No encontramos ese producto.';

// Ficha editable de un producto y su edición (mismas reglas que el panel web;
// un cambio de precio queda en el historial con el vendedor que lo hizo).
export const GET = api<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller', 120, 60_000, session.sub);
  const p = await getProductById(routeId((await params).id, NOT_FOUND));
  if (!p) throw new ApiError(404, 'NOT_FOUND', NOT_FOUND);
  return ok({
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    nameKorean: p.nameKorean,
    description: p.description,
    categoryId: p.categoryId,
    category: p.category.name,
    priceCLP: p.priceCLP,
    costCLP: p.costCLP,
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    weightGrams: p.weightGrams,
    // Tal como están guardadas (para reenviarlas al editar) y listas para mostrar.
    images: p.images,
    imageUrls: publicImages(p.images, siteOrigin(req.url)),
    active: p.active,
    featured: p.featured,
    archived: p.archivedAt !== null,
  });
});

export const POST = api<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller-write', 30, 60_000, session.sub);
  const id = routeId((await params).id, NOT_FOUND);
  const body = await jsonBody(req, 32 * 1024);
  return ok(settled(await updateProductAs({ ...(body as object), id }, session.sub)));
});
