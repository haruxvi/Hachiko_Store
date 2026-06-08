import { db } from '@/src/lib/db';
import { decrypt, encrypt, decryptOptional } from '@/src/lib/crypto/pii';
import { writeAudit } from './audit.service';
import type { Role } from '@prisma/client';

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

export async function getFullUserForAdmin(
  targetUserId: string,
  actorId: string,
  actorRole: Role,
  reason: string
) {
  await writeAudit({
    actorId,
    actorRole,
    action: 'PII_ACCESS',
    targetType: 'User',
    targetId: targetUserId,
    metadata: { reason },
  });

  const user = await db.user.findUnique({
    where: { id: targetUserId },
    include: { orders: { take: 5, orderBy: { createdAt: 'desc' } }, addresses: true },
  });

  if (!user) throw new Error('Usuario no encontrado');

  return {
    ...user,
    phone: decryptOptional(user.phone),
    addresses: user.addresses.map((a) => ({
      ...a,
      fullName: decrypt(a.fullName),
      street: decrypt(a.street),
      number: decrypt(a.number),
      apartment: a.apartment ? decrypt(a.apartment) : null,
      phone: decrypt(a.phone),
    })),
  };
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
