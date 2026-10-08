import type { NextRequest } from 'next/server';
import { db } from '@/src/lib/db';
import { getSellerDashboardKpis, getLowStockProducts } from '@/src/lib/services/dashboard.service';
import { getAlerts } from '@/src/lib/services/intelligence.service';
import { api, limit, ok, options, requireSession } from '@/src/lib/api/v1';

export { options as OPTIONS };

// "Hoy": lo que el vendedor necesita apenas abre la app. Mismas reglas que el
// Resumen web (ventas válidas, días de Chile).
export const GET = api(async (req: NextRequest) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller', 120, 60_000, session.sub);

  const [kpis, lowStock, alerts, toPack] = await Promise.all([
    getSellerDashboardKpis(),
    getLowStockProducts(),
    getAlerts(),
    db.order.findMany({
      where: { paymentStatus: 'PAID', status: { in: ['PAID', 'PREPARING'] } },
      orderBy: { createdAt: 'asc' }, // primero lo que lleva más tiempo esperando
      take: 5,
      select: { id: true, orderNumber: true, shippingMethod: true, shippingCommune: true, totalCLP: true, createdAt: true, status: true, _count: { select: { items: true } } },
    }),
  ]);
  const flagged = new Set(
    (await db.riskScore.findMany({ where: { subjectType: 'ORDER', subjectId: { in: toPack.map((o) => o.id) } }, select: { subjectId: true } })).map((r) => r.subjectId),
  );

  return ok({
    kpis: {
      toPack: kpis.operational.toPack,
      preparing: kpis.operational.preparing,
      awaitingPayment: kpis.operational.awaitingPayment,
      salesToday: kpis.revenue.today,
      ordersToday: kpis.revenue.todayCount,
      salesWeek: kpis.revenue.week,
      salesMonth: kpis.revenue.month,
      lowStockCount: kpis.inventory.lowStockCount,
    },
    toPack: toPack.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      isPickup: o.shippingMethod === 'PICKUP',
      commune: o.shippingCommune,
      itemCount: o._count.items,
      totalCLP: o.totalCLP,
      createdAt: o.createdAt,
      flagged: flagged.has(o.id),
    })),
    lowStock: lowStock.slice(0, 5).map((p) => ({ id: p.id, name: p.name, stock: p.stock, threshold: p.lowStockThreshold })),
    alerts,
  });
});
