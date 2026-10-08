import { db } from '@/src/lib/db';
import { Prisma } from '@prisma/client';
import { SALE_SQL, SALE_WHERE, localTs } from '@/src/lib/sales';
import { startOfStoreDay, storeDaysAgo } from '@/src/lib/store-time';
import { fetchPage } from '@/src/lib/panel-list';
import { productSearchWhere } from '@/src/lib/services/catalog.service';

export async function getSellerDashboardKpis() {
  // Días en hora de Chile ("hoy" = desde la medianoche de Santiago).
  const today = startOfStoreDay();
  const last7d = storeDaysAgo(7);
  const last30d = storeDaysAgo(30);

  const [
    toPack,
    preparing,
    awaitingPayment,
    todayRevenue,
    weekRevenue,
    monthRevenue,
    lowStockResult,
    totalProductsActive,
    totalStockUnits,
  ] = await Promise.all([
    // Lo mismo que "Por empacar" en Por despachar: pagadas y aún sin enviar.
    db.order.count({
      where: { paymentStatus: 'PAID', status: { in: ['PAID', 'PREPARING'] } },
    }),
    db.order.count({
      where: { paymentStatus: 'PAID', status: 'PREPARING' },
    }),
    db.order.count({
      where: { paymentStatus: 'UNPAID', status: 'PENDING', createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    }),
    db.order.aggregate({
      where: { ...SALE_WHERE, paidAt: { gte: today } },
      _sum: { subtotalCLP: true },
      _count: true,
    }),
    db.order.aggregate({
      where: { ...SALE_WHERE, paidAt: { gte: last7d } },
      _sum: { subtotalCLP: true },
    }),
    db.order.aggregate({
      where: { ...SALE_WHERE, paidAt: { gte: last30d } },
      _sum: { subtotalCLP: true },
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
      toPack,
      preparing,
      awaitingPayment,
    },
    revenue: {
      today: todayRevenue._sum.subtotalCLP ?? 0,
      todayCount: todayRevenue._count,
      week: weekRevenue._sum.subtotalCLP ?? 0,
      month: monthRevenue._sum.subtotalCLP ?? 0,
    },
    inventory: {
      lowStockCount: Number(lowStockResult[0]?.count ?? 0),
      totalProductsActive,
      totalStockUnits: totalStockUnits._sum.stock ?? 0,
    },
  };
}

export async function getTopSellingProducts(days = 30, limit = 10) {
  const since = storeDaysAgo(days);

  const result = await db.orderItem.groupBy({
    by: ['productId', 'productName'],
    where: {
      order: { ...SALE_WHERE, paidAt: { gte: since } },
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

// `date` es la medianoche del día en Chile, representada como fecha UTC:
// mostrarla con timeZone 'UTC' para no correrla un día.
export async function getDailyRevenue(days = 30) {
  const since = storeDaysAgo(days);
  const day = Prisma.sql`DATE_TRUNC('day', ${localTs(Prisma.sql`o."paidAt"`)})`;

  const result = await db.$queryRaw<
    Array<{ date: Date; revenue: bigint; orders: bigint }>
  >`
    SELECT
      ${day} AS date,
      SUM(o."subtotalCLP")::bigint AS revenue,
      COUNT(*)::bigint AS orders
    FROM "Order" o
    WHERE ${SALE_SQL}
      AND o."paidAt" >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
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

  // Un producto sin costo no suma "$0" al costo: se cuenta aparte para avisarlo.
  return products.reduce(
    (acc, p) => ({
      atCost: acc.atCost + (p.costCLP ?? 0) * p.stock,
      atRetail: acc.atRetail + p.priceCLP * p.stock,
      units: acc.units + p.stock,
      withoutCost: acc.withoutCost + (p.costCLP === null && p.stock > 0 ? 1 : 0),
    }),
    { atCost: 0, atRetail: 0, units: 0, withoutCost: 0 },
  );
}

export async function getInventoryMaster(opts: {
  q: string;
  categoryId?: string;
  lowOnly: boolean;
  page: number;
  perPage: number;
}) {
  const where: Prisma.ProductWhereInput = {
    active: true,
    archivedAt: null,
    ...productSearchWhere(opts.q),
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    // Bajo stock = stock físico <= umbral del mismo producto (comparación entre columnas).
    ...(opts.lowOnly ? { stock: { lte: db.product.fields.lowStockThreshold } } : {}),
  };

  // El conteo de "necesitan reposición" es de todo el inventario, no solo de lo filtrado.
  const [lowCount, { info, items: products }] = await Promise.all([
    db.product.count({
      where: { active: true, archivedAt: null, stock: { lte: db.product.fields.lowStockThreshold } },
    }),
    fetchPage(
      opts.page,
      opts.perPage,
      () => db.product.count({ where }),
      (skip, take) =>
        db.product.findMany({
          where,
          skip,
          take,
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
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
    ),
  ]);

  // Reservas solo de los productos de esta página.
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

  return {
    info,
    lowCount,
    products: products.map((p) => ({
      ...p,
      reserved: reservedMap.get(p.id) ?? 0,
      available: p.stock - (reservedMap.get(p.id) ?? 0),
      isLowStock: p.stock <= p.lowStockThreshold,
    })),
  };
}
