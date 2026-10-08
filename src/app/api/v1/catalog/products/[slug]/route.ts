import type { NextRequest } from 'next/server';
import { db } from '@/src/lib/db';
import { getAvailableStockBatch } from '@/src/lib/services/inventory.service';
import { productCard, publicImages, siteOrigin, stockInfo } from '@/src/lib/api/dto';
import { api, ApiError, limit, ok, options } from '@/src/lib/api/v1';

export { options as OPTIONS };

const cardSelect = {
  id: true, slug: true, name: true, nameKorean: true, priceCLP: true, images: true,
  stock: true, lowStockThreshold: true, category: { select: { name: true, slug: true } },
} as const;

// Ficha del producto + "se compran juntos" (reglas de asociación del modelo de
// ML; si aún no hay, productos de la misma categoría).
export const GET = api<{ slug: string }>(async (req: NextRequest, { params }) => {
  await limit(req, 'catalog', 120, 60_000);
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) throw new ApiError(404, 'NOT_FOUND', 'No encontramos ese producto.');

  const product = await db.product.findFirst({
    where: { slug, active: true, archivedAt: null },
    select: { ...cardSelect, description: true, weightGrams: true, categoryId: true },
  });
  if (!product) throw new ApiError(404, 'NOT_FOUND', 'No encontramos ese producto.');

  const basket = await db.productRecommendation.findMany({
    where: { productId: product.id, strategy: 'BASKET', recommended: { active: true, archivedAt: null } },
    orderBy: { score: 'desc' },
    take: 6,
    select: { recommended: { select: cardSelect } },
  });
  let together = basket.map((r) => r.recommended);
  if (together.length < 3) {
    const more = await db.product.findMany({
      where: { categoryId: product.categoryId, active: true, archivedAt: null, id: { notIn: [product.id, ...together.map((p) => p.id)] } },
      orderBy: { createdAt: 'desc' },
      take: 6 - together.length,
      select: cardSelect,
    });
    together = [...together, ...more];
  }

  const available = await getAvailableStockBatch([product.id, ...together.map((p) => p.id)]);
  const base = siteOrigin(req.url);
  const own = available.get(product.id) ?? product.stock;
  return ok({
    ...productCard(product, base, own),
    images: publicImages(product.images, base),
    description: product.description,
    weightGrams: product.weightGrams,
    // Tope para el selector de cantidad: lo disponible, sin revelar el número exacto si sobra.
    maxQuantity: Math.max(0, Math.min(own, 10)),
    ...stockInfo(own, product.lowStockThreshold),
    together: together.map((p) => productCard(p, base, available.get(p.id) ?? p.stock)),
    webUrl: new URL(`/producto/${product.slug}`, base).toString(),
  });
});
