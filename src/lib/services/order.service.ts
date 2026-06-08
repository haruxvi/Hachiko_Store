import { db } from '@/src/lib/db';
import { encrypt, decrypt } from '@/src/lib/crypto/pii';
import { decrementStock, incrementStock } from './catalog.service';
import { writeAudit } from './audit.service';
import type { Role } from '@prisma/client';

export interface CartItem {
  productId: string;
  quantity: number;
}

const SHIPPING_CLP = 3990;
const FREE_SHIPPING_THRESHOLD = 50000;

export function calculateShipping(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_CLP;
}

interface ShippingAddress {
  fullName: string;
  street: string;
  number: string;
  apartment?: string;
  commune: string;
  region: string;
  phone: string;
  email: string;
  notes?: string;
}

export async function createOrder(
  userId: string,
  items: CartItem[],
  shippingAddress: ShippingAddress
) {
  if (items.length === 0) throw new Error('El carrito está vacío');

  const products = await db.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, active: true },
  });

  if (products.length !== items.length) {
    throw new Error('Uno o más productos no están disponibles');
  }

  let subtotalCLP = 0;
  const orderItems: Array<{
    productId: string;
    quantity: number;
    unitPriceCLP: number;
    productName: string;
  }> = [];

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new Error(`Producto no encontrado: ${item.productId}`);
    if (product.stock < item.quantity) {
      throw new Error(`Stock insuficiente para: ${product.name}`);
    }
    subtotalCLP += product.priceCLP * item.quantity;
    orderItems.push({
      productId: product.id,
      quantity: item.quantity,
      unitPriceCLP: product.priceCLP,
      productName: product.name,
    });
  }

  const shippingCLP = calculateShipping(subtotalCLP);
  const totalCLP = subtotalCLP + shippingCLP;

  // Decrement stock with optimistic locking
  for (const item of items) {
    const ok = await decrementStock(item.productId, item.quantity);
    if (!ok) throw new Error('Stock insuficiente (concurrencia)');
  }

  const order = await db.order.create({
    data: {
      userId,
      subtotalCLP,
      shippingCLP,
      totalCLP,
      shippingFullName: encrypt(shippingAddress.fullName),
      shippingStreet: encrypt(shippingAddress.street),
      shippingNumber: encrypt(shippingAddress.number),
      shippingApartment: shippingAddress.apartment ? encrypt(shippingAddress.apartment) : null,
      shippingCommune: shippingAddress.commune,
      shippingRegion: shippingAddress.region,
      shippingPhone: encrypt(shippingAddress.phone),
      shippingEmail: encrypt(shippingAddress.email),
      shippingNotes: shippingAddress.notes,
      items: { create: orderItems },
    },
    include: { items: true },
  });

  await writeAudit({
    actorId: userId,
    action: 'ORDER_CREATED',
    targetType: 'Order',
    targetId: order.id,
    metadata: { totalCLP: totalCLP, itemCount: items.length },
  });

  return order;
}

export async function getOrderForClient(orderId: string, userId: string) {
  return db.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true },
  });
}

export async function getClientOrders(userId: string) {
  return db.order.findMany({
    where: { userId },
    include: { items: { select: { productName: true, quantity: true, unitPriceCLP: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

// SELLER view — minimal PII, only paid orders
export async function getOrdersForSeller() {
  const orders = await db.order.findMany({
    where: { paymentStatus: 'PAID', status: { not: 'CANCELLED' } },
    include: { items: { select: { productName: true, quantity: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map((o) => ({
    orderNumber: o.orderNumber,
    id: o.id,
    items: o.items.map((i) => ({ name: i.productName, quantity: i.quantity })),
    totalCLP: o.totalCLP,
    status: o.status,
    paymentStatus: o.paymentStatus,
    recipientName: decrypt(o.shippingFullName),
    shippingStreet: decrypt(o.shippingStreet),
    shippingNumber: decrypt(o.shippingNumber),
    shippingApartment: o.shippingApartment ? decrypt(o.shippingApartment) : undefined,
    shippingCommune: o.shippingCommune,
    shippingRegion: o.shippingRegion,
    shippingPhone: decrypt(o.shippingPhone),
    shippingEmail: decrypt(o.shippingEmail),
    shippingNotes: o.shippingNotes,
    createdAt: o.createdAt,
  }));
}

export async function markOrderPaid(
  orderId: string,
  provider: string,
  paymentRef: string
) {
  return db.order.update({
    where: { id: orderId },
    data: {
      status: 'PAID',
      paymentStatus: 'PAID',
      paymentProvider: provider,
      paymentRef,
      paidAt: new Date(),
    },
  });
}

export async function markOrderShipped(
  orderId: string,
  trackingNumber: string,
  actorId: string,
  actorRole: Role
) {
  const order = await db.order.update({
    where: { id: orderId },
    data: { status: 'SHIPPED', trackingNumber, shippedAt: new Date() },
  });

  await writeAudit({
    actorId,
    actorRole,
    action: 'ORDER_SHIPPED',
    targetType: 'Order',
    targetId: orderId,
    metadata: { trackingNumber },
  });

  return order;
}

export async function cancelOrder(orderId: string, userId: string) {
  const order = await db.order.findFirst({ where: { id: orderId, userId } });
  if (!order) throw new Error('Orden no encontrada');
  if (!['PENDING', 'PAID'].includes(order.status)) {
    throw new Error('No se puede cancelar una orden en este estado');
  }

  await db.order.update({
    where: { id: orderId },
    data: { status: 'CANCELLED' },
  });

  // Restore stock
  const items = await db.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    await incrementStock(item.productId, item.quantity);
  }
}
