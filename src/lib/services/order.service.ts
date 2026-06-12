import { db } from '@/src/lib/db';
import { encrypt, decrypt, encryptOptional } from '@/src/lib/crypto/pii';
import { calculateShipping } from '@/src/lib/shipping';
import { sendEmail, orderShippedEmail } from '@/src/lib/email';
import { writeAudit } from './audit.service';
import { releaseReservation } from './inventory.service';
import { addMinutes } from 'date-fns';
import type { ShippingMethod } from '@prisma/client';

const RESERVATION_TTL_MIN = Number(process.env['RESERVATION_TTL_MINUTES'] ?? 15);

export interface CartItem {
  productId: string;
  quantity: number;
}

// Datos de entrega. Calle/comuna/región van vacíos cuando el método es PICKUP
interface ShippingAddress {
  fullName: string;
  street?: string;
  number?: string;
  apartment?: string;
  commune?: string;
  region?: string;
  phone: string;
  notes?: string;
}

export async function createOrder(
  userId: string,
  items: CartItem[],
  shippingMethod: ShippingMethod,
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

  const shippingCLP = calculateShipping(subtotalCLP, shippingMethod);
  const totalCLP = subtotalCLP + shippingCLP;

  // Create order + reserve stock atomically
  const order = await db.$transaction(
    async (tx) => {
      // Check availability with active reservations before creating order
      const reservations = await tx.stockReservation.groupBy({
        by: ['productId'],
        where: {
          productId: { in: orderItems.map((i) => i.productId) },
          expiresAt: { gt: new Date() },
        },
        _sum: { quantity: true },
      });
      const reservedMap = new Map(reservations.map((r) => [r.productId, r._sum.quantity ?? 0]));

      for (const item of orderItems) {
        const product = products.find((p) => p.id === item.productId)!;
        const available = product.stock - (reservedMap.get(item.productId) ?? 0);
        if (available < item.quantity) {
          throw new Error(`Stock insuficiente para: ${product.name}`);
        }
      }

      const newOrder = await tx.order.create({
        data: {
          userId,
          subtotalCLP,
          shippingCLP,
          totalCLP,
          shippingMethod,
          shippingFullName: encrypt(shippingAddress.fullName),
          shippingStreet: encryptOptional(shippingAddress.street),
          shippingNumber: encryptOptional(shippingAddress.number),
          shippingApartment: encryptOptional(shippingAddress.apartment),
          shippingCommune: shippingAddress.commune ?? null,
          shippingRegion: shippingAddress.region ?? null,
          shippingPhone: encrypt(shippingAddress.phone),
          shippingNotes: shippingAddress.notes,
          items: { create: orderItems },
        },
        include: { items: true },
      });

      // Create reservations
      await tx.stockReservation.createMany({
        data: orderItems.map((item) => ({
          productId: item.productId,
          orderId: newOrder.id,
          quantity: item.quantity,
          expiresAt: addMinutes(new Date(), RESERVATION_TTL_MIN),
        })),
      });

      return newOrder;
    },
    { isolationLevel: 'Serializable', maxWait: 5000, timeout: 10000 },
  );

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

// Para iniciar un pago: la orden debe pertenecer al usuario y estar impaga
export async function getUnpaidOrderForUser(orderId: string, userId: string) {
  return db.order.findFirst({
    where: { id: orderId, userId, paymentStatus: 'UNPAID' },
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

// Vista SELLER — solo lo indispensable para generar la etiqueta Starken y despachar
export async function getOrdersForSeller() {
  const orders = await db.order.findMany({
    where: { paymentStatus: 'PAID', status: { not: 'CANCELLED' } },
    include: { items: { select: { productName: true, quantity: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map((o) => ({
    orderNumber: o.orderNumber,
    id: o.id,
    // Qué hay que empacar
    items: o.items.map((i) => ({ name: i.productName, quantity: i.quantity })),
    // Estado para saber si ya fue marcado como enviado
    status: o.status,
    totalCLP: o.totalCLP,
    // Método elegido por el cliente: define qué se muestra (dirección o retiro)
    shippingMethod: o.shippingMethod,
    // Datos de etiqueta — descifrados aquí en el service, no en la UI
    recipientName: decrypt(o.shippingFullName),
    shippingStreet: o.shippingStreet ? decrypt(o.shippingStreet) : undefined,
    shippingNumber: o.shippingNumber ? decrypt(o.shippingNumber) : undefined,
    shippingApartment: o.shippingApartment ? decrypt(o.shippingApartment) : undefined,
    shippingCommune: o.shippingCommune ?? undefined,
    shippingRegion: o.shippingRegion ?? undefined,
    shippingPhone: decrypt(o.shippingPhone),
    shippingNotes: o.shippingNotes ?? undefined,
    createdAt: o.createdAt,
  }));
}

export async function markOrderShipped(
  orderId: string,
  trackingNumber: string | null,
  actorId: string,
  actorRole: 'SELLER'
) {
  const order = await db.order.update({
    where: { id: orderId },
    data: { status: 'SHIPPED', trackingNumber, shippedAt: new Date() },
    include: { user: { select: { email: true } } },
  });

  await writeAudit({
    actorId,
    actorRole,
    action: 'ORDER_SHIPPED',
    targetType: 'Order',
    targetId: orderId,
    metadata: { trackingNumber, shippingMethod: order.shippingMethod },
  });

  // "Va en camino" (courier) o "listo para retiro" (pickup), según lo que
  // eligió el cliente. Un fallo del correo no revierte el despacho.
  const email = orderShippedEmail({
    orderNumber: order.orderNumber,
    shippingMethod: order.shippingMethod,
    trackingNumber,
  });
  await sendEmail({ to: order.user.email, ...email });

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

  // For PENDING orders: release the reservation so stock becomes available again.
  // For PAID orders: stock was already deducted; a manual RETURNED adjustment is needed if goods come back.
  if (order.status === 'PENDING') {
    await releaseReservation(orderId);
  }
}
