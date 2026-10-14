import { db } from '@/src/lib/db';

// Utilidades compartidas por los tests de integración (base local desechable).

export const PICKUP = { fullName: 'Cliente Prueba', phone: '+56912345678' };

export async function resetDb() {
  await db.$executeRawUnsafe(`TRUNCATE TABLE
    "StockMovement", "StockReservation", "StockAdjustment", "OrderStatusHistory", "OrderItem", "Order",
    "Address", "ActionToken", "RefreshToken", "DeletionRequest", "CustomerSegment", "AnalyticsEvent",
    "NewsletterSubscriber", "AuditLog", "PriceHistory", "Product", "Category", "User" CASCADE`);
}

let seq = 0;

export async function makeUser(extra: Record<string, unknown> = {}) {
  seq++;
  return db.user.create({
    data: {
      email: `cliente${seq}@test.local`,
      passwordHash: 'x',
      consentEssential: true,
      consentVersion: 'test',
      consentAt: new Date(),
      ...extra,
    },
  });
}

export async function makeProduct(stock: number, priceCLP = 10_000) {
  seq++;
  const category = await db.category.create({ data: { name: `Cat ${seq}`, slug: `cat-${seq}` } });
  return db.product.create({
    data: {
      sku: `SKU-${seq}`,
      slug: `producto-${seq}`,
      name: `Producto ${seq}`,
      description: 'Producto de prueba',
      priceCLP,
      stock,
      weightGrams: 100,
      images: [],
      categoryId: category.id,
    },
  });
}

export const stockOf = async (id: string) => (await db.product.findUniqueOrThrow({ where: { id } })).stock;
export const orderOf = (id: string) => db.order.findUniqueOrThrow({ where: { id } });
