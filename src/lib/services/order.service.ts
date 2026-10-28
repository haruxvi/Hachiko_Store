import { db } from '@/src/lib/db';
import { encrypt, decrypt, encryptOptional } from '@/src/lib/crypto/pii';
import { calculateShipping } from '@/src/lib/shipping';
import { sendEmail, orderShippedEmail } from '@/src/lib/email';
import { writeAudit } from './audit.service';
import { activeReservations, withSerializableRetry } from './inventory.service';
import { pickupDeadline } from './pickup.service';
import { addMinutes } from 'date-fns';
import type { OrderStatus, ShippingMethod } from '@prisma/client';

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

  // Todo (precio, stock, reservas, creación) ocurre en UNA transacción
  // Serializable con reintentos: si dos clientes compran la última unidad a la
  // vez, Postgres aborta a uno, el reintento ve la reserva del otro y recibe
  // "Stock insuficiente". Leer el producto fuera de la transacción dejaba una
  // ventana en la que el stock podía cambiar entre la lectura y la reserva.
  const order = await withSerializableRetry(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: items.map((i) => i.productId) }, active: true, archivedAt: null },
    });
    if (products.length !== items.length) {
      throw new Error('Uno o más productos no están disponibles');
    }

    const reservedMap = await activeReservations(tx, products.map((p) => p.id));
    let subtotalCLP = 0;
    const orderItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const available = product.stock - (reservedMap.get(product.id) ?? 0);
      if (available < item.quantity) {
        throw new Error(`Stock insuficiente para: ${product.name}`);
      }
      subtotalCLP += product.priceCLP * item.quantity;
      return {
        productId: product.id,
        quantity: item.quantity,
        unitPriceCLP: product.priceCLP,
        productName: product.name,
      };
    });

    const shippingCLP = calculateShipping(subtotalCLP, shippingMethod);
    const totalCLP = subtotalCLP + shippingCLP;

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

    await tx.stockReservation.createMany({
      data: orderItems.map((item) => ({
        productId: item.productId,
        orderId: newOrder.id,
        quantity: item.quantity,
        expiresAt: addMinutes(new Date(), RESERVATION_TTL_MIN),
      })),
    });

    await tx.orderStatusHistory.create({
      data: { orderId: newOrder.id, fromStatus: null, toStatus: 'PENDING', actorId: userId, note: 'Pedido creado' },
    });

    return newOrder;
  });

  await writeAudit({
    actorId: userId,
    action: 'ORDER_CREATED',
    targetType: 'Order',
    targetId: order.id,
    metadata: { totalCLP: order.totalCLP, itemCount: items.length },
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

// Vista SELLER — solo lo indispensable para generar la etiqueta Starken y despachar.
// Solo trae lo que sigue en el flujo de despacho (por empacar / preparando / enviado).
// Excluye ENTREGADO y CANCELADO: son estados finales que no se despachan y, al
// acumularse miles, obligaban a descifrar ~5 campos PII por orden en cada carga.
const DISPATCH_STATUSES = ['PAID', 'PREPARING', 'SHIPPED'] as const;

export async function getOrdersForSeller() {
  const orders = await db.order.findMany({
    where: { paymentStatus: 'PAID', status: { in: [...DISPATCH_STATUSES] } },
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
    // Para retiro en tienda: desde cuándo espera (corre el plazo de retiro)
    shippedAt: o.shippedAt,
  }));
}

/** Detalle de UNA orden del flujo de despacho, con los datos de etiqueta descifrados. */
export async function getSellerOrderDetail(orderId: string) {
  const o = await db.order.findFirst({
    where: { id: orderId, paymentStatus: 'PAID' },
    include: { items: { select: { productName: true, quantity: true, unitPriceCLP: true, product: { select: { sku: true } } } } },
  });
  if (!o) return null;
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    totalCLP: o.totalCLP,
    subtotalCLP: o.subtotalCLP,
    shippingCLP: o.shippingCLP,
    shippingMethod: o.shippingMethod,
    trackingNumber: o.trackingNumber,
    createdAt: o.createdAt,
    paidAt: o.paidAt,
    shippedAt: o.shippedAt,
    items: o.items.map((i) => ({ name: i.productName, sku: i.product.sku, quantity: i.quantity, unitPriceCLP: i.unitPriceCLP })),
    recipientName: decrypt(o.shippingFullName),
    shippingStreet: o.shippingStreet ? decrypt(o.shippingStreet) : null,
    shippingNumber: o.shippingNumber ? decrypt(o.shippingNumber) : null,
    shippingApartment: o.shippingApartment ? decrypt(o.shippingApartment) : null,
    shippingCommune: o.shippingCommune,
    shippingRegion: o.shippingRegion,
    shippingPhone: decrypt(o.shippingPhone),
    shippingNotes: o.shippingNotes,
  };
}

export async function markOrderShipped(
  orderId: string,
  trackingNumber: string | null,
  actorId: string,
  actorRole: 'SELLER'
) {
  // Solo una orden pagada y aún sin despachar pasa a SHIPPED. La condición va en
  // el mismo UPDATE: dos clics (o dos pestañas) no la despachan dos veces ni
  // mandan dos correos, y una orden cancelada no puede marcarse como enviada.
  const shipped = await db.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
    const { count } = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: 'PAID', status: { in: ['PAID', 'PREPARING'] } },
      data: { status: 'SHIPPED', trackingNumber, shippedAt: new Date() },
    });
    if (count === 0 || !current) return false;
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: current.status, toStatus: 'SHIPPED', actorId, note: trackingNumber ? `Seguimiento ${trackingNumber}` : null },
    });
    return true;
  });
  if (!shipped) throw new Error('Esta orden ya fue despachada o no está lista para despacharse.');

  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
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
    pickupDeadline: order.shippingMethod === 'PICKUP' && order.shippedAt ? pickupDeadline(order.shippedAt) : undefined,
  });
  await sendEmail({ to: order.user.email, ...email });

  return order;
}

/**
 * Avanza un pedido pagado en el flujo de despacho. La condición de estado va en
 * el mismo UPDATE (dos clics o dos dispositivos no lo avanzan dos veces) y la
 * transición queda en OrderStatusHistory: de ahí salen los tiempos de
 * preparación y de entrega por courier de la vista Logística.
 */
async function advanceDispatch(
  orderId: string,
  from: OrderStatus[],
  to: 'PREPARING' | 'DELIVERED',
  actorId: string,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
    const { count } = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: 'PAID', status: { in: from } },
      data: { status: to, ...(to === 'DELIVERED' ? { deliveredAt: new Date() } : {}) },
    });
    if (count === 0 || !current) return false;
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: current.status, toStatus: to, actorId },
    });
    await tx.auditLog.create({
      data: { actorId, actorRole: 'SELLER', action: `ORDER_${to}`, targetType: 'Order', targetId: orderId },
    });
    return true;
  });
}

/** "Lo estoy empacando": PAID → PREPARING. */
export async function markOrderPreparing(orderId: string, actorId: string) {
  if (!(await advanceDispatch(orderId, ['PAID'], 'PREPARING', actorId))) {
    throw new Error('Este pedido ya no está esperando preparación.');
  }
}

/**
 * Entregado al cliente (courier) o retirado en tienda: SHIPPED → DELIVERED.
 * Sale de la lista de despacho y cierra su línea de tiempo.
 */
export async function markOrderDelivered(orderId: string, actorId: string) {
  if (!(await advanceDispatch(orderId, ['SHIPPED'], 'DELIVERED', actorId))) {
    throw new Error('Solo un pedido enviado (o listo para retiro) puede marcarse como entregado.');
  }
}

// El cliente solo puede cancelar un pedido que AÚN NO está pagado. La
// condición va en el mismo UPDATE: si el pago se confirma en el mismo instante,
// solo una de las dos operaciones gana (nunca "pagado y cancelado" a la vez).
// Un pago que llegue después de cancelar no revive el pedido: queda marcado
// para reembolso (ver payment.service). Un pedido ya pagado se gestiona como
// devolución con la tienda, no con este botón.
export async function cancelOrder(orderId: string, userId: string) {
  const cancelled = await withSerializableRetry(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, userId, status: 'PENDING', paymentStatus: { in: ['UNPAID', 'FAILED'] } },
      data: { status: 'CANCELLED' },
    });
    if (count === 0) return false;
    await tx.stockReservation.deleteMany({ where: { orderId } });
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: 'PENDING', toStatus: 'CANCELLED', actorId: userId, note: 'Cancelado por el cliente' },
    });
    return true;
  });

  if (!cancelled) {
    const order = await db.order.findFirst({ where: { id: orderId, userId }, select: { paymentStatus: true } });
    if (!order) throw new Error('Orden no encontrada');
    if (order.paymentStatus === 'PAID') {
      throw new Error('Este pedido ya está pagado. Escríbenos para gestionar una devolución.');
    }
    throw new Error('No se puede cancelar una orden en este estado');
  }

  await writeAudit({ actorId: userId, actorRole: 'CLIENT', action: 'ORDER_CANCELLED', targetType: 'Order', targetId: orderId });
}
