import { db } from '@/src/lib/db';
import { encrypt, decrypt, decryptOptional } from '@/src/lib/crypto/pii';
import { writeAudit } from './audit.service';
import { unsubscribeEmailEverywhere } from './newsletter.service';

export async function exportUserData(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId, deletedAt: null },
    include: {
      orders: {
        include: { items: true },
      },
      addresses: true,
    },
  });

  if (!user) throw new Error('Usuario no encontrado');

  await db.dataExportRequest.create({
    data: { userId, requestedAt: new Date() },
  });

  await writeAudit({ actorId: userId, action: 'DATA_EXPORT', targetType: 'User', targetId: userId });

  return {
    account: {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: decryptOptional(user.phone),
      role: user.role,
      consentMarketing: user.consentMarketing,
      consentVersion: user.consentVersion,
      consentAt: user.consentAt,
      createdAt: user.createdAt,
    },
    addresses: user.addresses.map((a) => ({
      fullName: decrypt(a.fullName),
      street: decrypt(a.street),
      number: decrypt(a.number),
      apartment: a.apartment ? decrypt(a.apartment) : null,
      commune: a.commune,
      region: a.region,
      phone: decrypt(a.phone),
      isDefault: a.isDefault,
    })),
    orders: user.orders.map((o) => ({
      orderNumber: o.orderNumber,
      totalCLP: o.totalCLP,
      status: o.status,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt,
      items: o.items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPriceCLP: i.unitPriceCLP,
      })),
    })),
    exportedAt: new Date().toISOString(),
  };
}

export async function requestAccountDeletion(userId: string, reason?: string) {
  const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await Promise.all([
    db.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    }),
    db.deletionRequest.create({
      data: { userId, scheduledFor, reason },
    }),
  ]);

  await writeAudit({
    actorId: userId,
    action: 'ACCOUNT_DELETE_REQUEST',
    targetType: 'User',
    targetId: userId,
    metadata: { scheduledFor },
  });
}

// Pedidos que todavía se están despachando: sus datos de entrega se necesitan
// para la etiqueta, así que la purga espera a que salgan de este estado.
const IN_DISPATCH = ['PAID', 'PREPARING'] as const;

/**
 * Ejecuta las solicitudes de eliminación cuyo plazo de 30 días ya venció
 * (Ley 21.719, derecho de supresión). Lo llama el cron diario de retención.
 *
 * - La cuenta se anonimiza en vez de borrarse: los pedidos deben conservarse
 *   por obligación tributaria (SII), así que se mantienen montos, productos y
 *   fechas, pero se elimina todo lo que identifica a la persona: email,
 *   nombre, teléfono, direcciones, datos de entrega, 2FA, tokens, segmentos de
 *   ML, suscripción a promociones y el vínculo con los eventos de navegación.
 * - El email se reemplaza por uno imposible, lo que libera el original: la
 *   persona puede volver a registrarse si quiere.
 * - Si tiene un pedido aún en despacho, se posterga al siguiente día.
 */
export async function executeDueDeletions(now = new Date()): Promise<{ executed: number; postponed: number }> {
  const due = await db.deletionRequest.findMany({
    where: { executedAt: null, scheduledFor: { lte: now } },
    select: { id: true, userId: true },
  });

  let executed = 0;
  let postponed = 0;
  for (const req of due) {
    const done = await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: req.userId }, select: { email: true } });
      if (!user) {
        await tx.deletionRequest.update({ where: { id: req.id }, data: { executedAt: now } });
        return true;
      }
      const inDispatch = await tx.order.count({ where: { userId: req.userId, status: { in: [...IN_DISPATCH] } } });
      if (inDispatch > 0) return false;

      await tx.user.update({
        where: { id: req.userId },
        data: {
          email: `eliminado+${req.userId}@hachiko.invalid`,
          passwordHash: '!deleted',
          firstName: null,
          lastName: null,
          phone: null,
          totpSecret: null,
          totpEnabledAt: null,
          consentMarketing: false,
          consentIp: null,
          deletedAt: now,
          tokenVersion: { increment: 1 },
        },
      });
      await tx.order.updateMany({
        where: { userId: req.userId },
        data: {
          shippingFullName: encrypt('[eliminado]'),
          shippingPhone: encrypt('[eliminado]'),
          shippingStreet: null,
          shippingNumber: null,
          shippingApartment: null,
          shippingNotes: null,
        },
      });
      await tx.address.deleteMany({ where: { userId: req.userId } });
      await tx.actionToken.deleteMany({ where: { userId: req.userId } });
      await tx.refreshToken.deleteMany({ where: { userId: req.userId } });
      await tx.customerSegment.deleteMany({ where: { userId: req.userId } });
      await tx.analyticsEvent.updateMany({ where: { userId: req.userId }, data: { userId: null } });
      await tx.newsletterSubscriber.deleteMany({ where: { email: user.email } });
      await tx.deletionRequest.update({ where: { id: req.id }, data: { executedAt: now } });
      await tx.auditLog.create({
        data: { actorId: req.userId, action: 'ACCOUNT_DELETED', targetType: 'User', targetId: req.userId },
      });
      return true;
    });
    if (done) executed++;
    else postponed++;
  }
  return { executed, postponed };
}

export async function updateUserProfile(
  userId: string,
  input: { firstName?: string; lastName?: string; phone?: string }
) {
  const data: Record<string, unknown> = {};
  if (input.firstName !== undefined) data['firstName'] = input.firstName;
  if (input.lastName !== undefined) data['lastName'] = input.lastName;
  if (input.phone !== undefined) data['phone'] = encrypt(input.phone);

  if (Object.keys(data).length === 0) return;
  await db.user.update({ where: { id: userId }, data });
}

// ─── Dirección de despacho guardada ──────────────────────

interface SavedAddressInput {
  fullName: string;
  street: string;
  number: string;
  apartment?: string;
  commune: string;
  region: string;
  phone: string;
}

// Devuelve la dirección por defecto descifrada para precargar el checkout
export async function getDefaultShippingAddress(userId: string) {
  const address = await db.address.findFirst({
    where: { userId, isDefault: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!address) return null;

  return {
    fullName: decrypt(address.fullName),
    street: decrypt(address.street),
    number: decrypt(address.number),
    apartment: address.apartment ? decrypt(address.apartment) : undefined,
    commune: address.commune,
    region: address.region,
    phone: decrypt(address.phone),
  };
}

// Guarda/actualiza la dirección por defecto tras un checkout con despacho,
// para precargar el siguiente. Cifrada igual que en la orden.
export async function saveDefaultShippingAddress(userId: string, input: SavedAddressInput) {
  const data = {
    fullName: encrypt(input.fullName),
    street: encrypt(input.street),
    number: encrypt(input.number),
    apartment: input.apartment ? encrypt(input.apartment) : null,
    commune: input.commune,
    region: input.region,
    phone: encrypt(input.phone),
    isDefault: true,
  };

  const existing = await db.address.findFirst({ where: { userId, isDefault: true } });
  if (existing) {
    await db.address.update({ where: { id: existing.id }, data });
  } else {
    await db.address.create({ data: { userId, ...data } });
  }
}

// Resumen para el perfil: cuántas compras pagadas tiene la persona y en qué va
// la última. Dos consultas livianas en paralelo (Order está indexado por userId).
export async function getAccountSummary(userId: string) {
  const paid = { userId, paymentStatus: 'PAID' as const };
  const [orderCount, lastOrder] = await Promise.all([
    // "Llevas N compras": las canceladas (reembolsadas) no cuentan como compra.
    db.order.count({ where: { ...paid, status: { not: 'CANCELLED' } } }),
    db.order.findFirst({
      where: paid,
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true, status: true, shippingMethod: true },
    }),
  ]);
  return { orderCount, lastOrder };
}

export async function updateUserConsent(
  userId: string,
  consentMarketing: boolean
) {
  const user = await db.user.update({
    where: { id: userId },
    data: {
      consentMarketing,
      consentUpdatedAt: new Date(),
    },
    select: { email: true },
  });

  // Revocar el marketing desde el perfil también da de baja una suscripción del
  // footer con el mismo correo: la persona deja de recibir promociones por
  // cualquier vía (Ley 21.719, revocación efectiva).
  if (!consentMarketing) await unsubscribeEmailEverywhere(user.email);

  await writeAudit({
    actorId: userId,
    action: 'CONSENT_UPDATED',
    targetType: 'User',
    targetId: userId,
    metadata: { consentMarketing },
  });
}
