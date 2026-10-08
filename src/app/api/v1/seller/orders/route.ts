import type { NextRequest } from 'next/server';
import { db } from '@/src/lib/db';
import { getOrdersForSeller } from '@/src/lib/services/order.service';
import { shippingLabel } from '@/src/lib/shipping';
import { matchesQuery, paginate, parseOption, parsePage, parseQuery } from '@/src/lib/panel-list';
import { api, limit, ok, options, requireSession } from '@/src/lib/api/v1';

export { options as OPTIONS };

const STATUS = ['empacar', 'enviadas', 'todas'] as const;
const TO_PACK = new Set(['PAID', 'PREPARING']);

// Por despachar. Los nombres van cifrados en la base, así que la búsqueda se
// hace sobre los datos ya descifrados (igual que el panel web).
export const GET = api(async (req: NextRequest) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller', 120, 60_000, session.sub);
  const sp = req.nextUrl.searchParams;
  const estado = parseOption(sp.get('estado') ?? undefined, STATUS, 'empacar');
  const q = parseQuery(sp.get('q') ?? undefined).replace(/^#\s*/, '');
  const page = parsePage(sp.get('pagina') ?? undefined);

  const all = await getOrdersForSeller();
  const counts = { empacar: all.filter((o) => TO_PACK.has(o.status)).length, enviadas: all.filter((o) => o.status === 'SHIPPED').length };
  const matching = all
    .filter((o) => estado === 'todas' || (estado === 'empacar' ? TO_PACK.has(o.status) : o.status === 'SHIPPED'))
    .filter((o) => matchesQuery(q, o.orderNumber, o.recipientName, o.shippingCommune, ...o.items.map((i) => i.name)))
    // Por empacar: lo más antiguo primero (es lo urgente). Enviadas: lo más reciente.
    .sort((a, b) => (estado === 'empacar' ? 1 : -1) * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  const info = paginate(matching.length, page, 20);
  const pageItems = matching.slice(info.skip, info.skip + info.take);
  const flagged = new Set(
    (await db.riskScore.findMany({ where: { subjectType: 'ORDER', subjectId: { in: pageItems.map((o) => o.id) } }, select: { subjectId: true } })).map((r) => r.subjectId),
  );

  return ok({
    counts,
    page: info.page,
    totalPages: info.totalPages,
    total: info.total,
    items: pageItems.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      recipientName: o.recipientName,
      isPickup: o.shippingMethod === 'PICKUP',
      shippingLabel: shippingLabel(o.shippingMethod),
      commune: o.shippingCommune ?? null,
      itemCount: o.items.reduce((a, i) => a + i.quantity, 0),
      totalCLP: o.totalCLP,
      createdAt: o.createdAt,
      flagged: flagged.has(o.id),
    })),
  });
});
