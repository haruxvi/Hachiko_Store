import type { NextRequest } from 'next/server';
import { getInventoryMaster } from '@/src/lib/services/dashboard.service';
import { parseOption, parsePage, parseQuery } from '@/src/lib/panel-list';
import { publicImages, siteOrigin } from '@/src/lib/api/dto';
import { db } from '@/src/lib/db';
import { api, limit, ok, options, requireSession } from '@/src/lib/api/v1';

export { options as OPTIONS };

// Inventario del vendedor: búsqueda por nombre/SKU y filtro "solo bajo el umbral".
export const GET = api(async (req: NextRequest) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller', 120, 60_000, session.sub);
  const sp = req.nextUrl.searchParams;
  const { info, lowCount, products } = await getInventoryMaster({
    q: parseQuery(sp.get('q') ?? undefined),
    lowOnly: parseOption(sp.get('stock') ?? undefined, ['todo', 'bajo'] as const, 'todo') === 'bajo',
    page: parsePage(sp.get('pagina') ?? undefined),
    perPage: 20,
  });
  const imgs = new Map(
    (await db.product.findMany({ where: { id: { in: products.map((p) => p.id) } }, select: { id: true, images: true } })).map((p) => [p.id, p.images]),
  );
  const base = siteOrigin(req.url);
  return ok({
    lowCount,
    page: info.page,
    totalPages: info.totalPages,
    total: info.total,
    items: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category.name,
      image: publicImages(imgs.get(p.id) ?? [], base)[0] ?? null,
      stock: p.stock,
      reserved: p.reserved,
      available: p.available,
      threshold: p.lowStockThreshold,
      isLow: p.isLowStock,
    })),
  });
});
