import { db } from '@/src/lib/db';
import { encrypt, decrypt, decryptOptional } from '@/src/lib/crypto/pii';
import { writeAudit } from './audit.service';

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

export async function updateUserConsent(
  userId: string,
  consentMarketing: boolean
) {
  await db.user.update({
    where: { id: userId },
    data: {
      consentMarketing,
      consentUpdatedAt: new Date(),
    },
  });

  await writeAudit({
    actorId: userId,
    action: 'CONSENT_UPDATED',
    targetType: 'User',
    targetId: userId,
    metadata: { consentMarketing },
  });
}
