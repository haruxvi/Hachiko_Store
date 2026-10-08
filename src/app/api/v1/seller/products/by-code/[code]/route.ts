import type { NextRequest } from 'next/server';
import { db } from '@/src/lib/db';
import { getAvailableStock } from '@/src/lib/services/inventory.service';
import { publicImages, siteOrigin } from '@/src/lib/api/dto';
import { api, ApiError, limit, ok, options, requireSession } from '@/src/lib/api/v1';

export { options as OPTIONS };

// Para el escáner del vendedor: busca un producto por SKU (el código impreso
// en la etiqueta). Solo se aceptan caracteres de SKU.
export const GET = api<{ code: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller', 120, 60_000, session.sub);
  const code = decodeURIComponent((await params).code).trim();
  if (!/^[A-Za-z0-9._-]{1,50}$/.test(code)) throw new ApiError(404, 'NOT_FOUND', 'Ese código no corresponde a un producto.');

  const p = await db.product.findFirst({
    where: { sku: { equals: code, mode: 'insensitive' } },
    select: { id: true, sku: true, name: true, stock: true, lowStockThreshold: true, priceCLP: true, images: true, archivedAt: true, category: { select: { name: true } } },
  });
  if (!p) throw new ApiError(404, 'NOT_FOUND', 'Ese código no corresponde a un producto.');
  return ok({
    id: p.id, sku: p.sku, name: p.name, category: p.category.name, priceCLP: p.priceCLP,
    image: publicImages(p.images, siteOrigin(req.url))[0] ?? null,
    stock: p.stock, available: await getAvailableStock(p.id), threshold: p.lowStockThreshold, archived: p.archivedAt !== null,
  });
});
