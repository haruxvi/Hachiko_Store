import { db } from '@/src/lib/db';
import { subDays, startOfDay } from 'date-fns';

export async function getSellerDashboardKpis() {
  const today = startOfDay(new Date());
  const last7d = subDays(today, 7);
  const last30d = subDays(today, 30);

  const [
    ordersToShipToday,
    readyToShip,
    awaitingPayment,
    todayRevenue,
    weekRevenue,
    monthRevenue,
    lowStockResult,
    totalProductsActive,
    totalStockUnits,
  ] = await Promise.all([
    db.order.count({
      where: { status: 'PAID', createdAt: { gte: today } },
    }),
    db.order.count({
      where: { status: 'PREPARING' },
    }),
    db.order.count({
      where: { paymentStatus: 'UNPAID', createdAt: { gte: subDays(today, 1) } },
    }),
    db.order.aggregate({
      where: { paymentStatus: 'PAID', paidAt: { gte: today } },
      _sum: { totalCLP: true },
      _count: true,
    }),
    db.order.aggregate({
      where: { paymentStatus: 'PAID', paidAt: { gte: last7d } },
      _sum: { totalCLP: true },
    }),
    db.order.aggregate({
      where: { paymentStatus: 'PAID', paidAt: { gte: last30d } },
      _sum: { totalCLP: true },
    }),
    db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Product"
      WHERE active = true
        AND "archivedAt" IS NULL
        AND stock <= "lowStockThreshold"
    `,
    db.product.count({ where: { active: true, archivedAt: null } }),
    db.product.aggregate({
      where: { active: true, archivedAt: null },
      _sum: { stock: true },
    }),
  ]);

  return {
    operational: {
      ordersToShipToday,
      readyToShip,
      awaitingPayment,
    },
    revenue: {
      today: todayRevenue._sum.totalCLP ?? 0,
      todayCount: todayRevenue._count,
      week: weekRevenue._sum.totalCLP ?? 0,
      month: monthRevenue._sum.totalCLP ?? 0,
    },
    inventory: {
      lowStockCount: Number(lowStockResult[0]?.count ?? 0),
      totalProductsActive,
      totalStockUnits: totalStockUnits._sum.stock ?? 0,
    },
  };
}

export async function getTopSellingProducts(days = 30, limit = 10) {
  const since = subDays(new Date(), days);

  const result = await db.orderItem.groupBy({
    by: ['productId', 'productName'],
    where: {
      order: { paymentStatus: 'PAID', paidAt: { gte: since } },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit,
  });

  return result.map((r) => ({
    productId: r.productId,
    productName: r.productName,
    unitsSold: r._sum.quantity ?? 0,
  }));
}

export async function getLowStockProducts() {
  return db.$queryRaw<
    Array<{ id: string; name: string; stock: number; lowStockThreshold: number }>
  >`
    SELECT id, name, stock, "lowStockThreshold"
    FROM "Product"
    WHERE active = true
      AND "archivedAt" IS NULL
      AND stock <= "lowStockThreshold"
    ORDER BY stock ASC
    LIMIT 20
  `;
}

export async function getDailyRevenue(days = 30) {
  const since = subDays(new Date(), days);

  const result = await db.$queryRaw<
    Array<{ date: Date; revenue: bigint; orders: bigint }>
  >`
    SELECT
      DATE_TRUNC('day', "paidAt") AS date,
      SUM("totalCLP")::bigint AS revenue,
      COUNT(*)::bigint AS orders
    FROM "Order"
    WHERE "paymentStatus" = 'PAID'
      AND "paidAt" >= ${since}
    GROUP BY DATE_TRUNC('day', "paidAt")
    ORDER BY date ASC
  `;

  return result.map((r) => ({
    date: r.date,
    revenue: Number(r.revenue),
    orders: Number(r.orders),
  }));
}

export async function getInventoryValuation() {
  const products = await db.product.findMany({
    where: { active: true, archivedAt: null },
    select: { stock: true, costCLP: true, priceCLP: true },
  });

  return products.reduce(
    (acc, p) => ({
      atCost: acc.atCost + (p.costCLP ?? 0) * p.stock,
      atRetail: acc.atRetail + p.priceCLP * p.stock,
      units: acc.units + p.stock,
    }),
    { atCost: 0, atRetail: 0, units: 0 },
  );
}

export async function getInventoryMaster() {
  const products = await db.product.findMany({
    where: { active: true, archivedAt: null },
    select: {
      id: true,
      sku: true,
      name: true,
      stock: true,
      lowStockThreshold: true,
      costCLP: true,
      priceCLP: true,
      category: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  });

  const reservations = await db.stockReservation.groupBy({
    by: ['productId'],
    where: {
      productId: { in: products.map((p) => p.id) },
      expiresAt: { gt: new Date() },
    },
    _sum: { quantity: true },
  });

  const reservedMap = new Map(
    reservations.map((r) => [r.productId, r._sum.quantity ?? 0]),
  );

  return products.map((p) => ({
    ...p,
    reserved: reservedMap.get(p.id) ?? 0,
    available: p.stock - (reservedMap.get(p.id) ?? 0),
    isLowStock: p.stock <= p.lowStockThreshold,
  }));
}
