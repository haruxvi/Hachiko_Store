import { db } from '@/src/lib/db';
import type { Role } from '@prisma/client';

export type AuditAction =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'REGISTER'
  | 'ROLE_CHANGE'
  | 'DATA_EXPORT'
  | 'ACCOUNT_DELETE_REQUEST'
  | 'ACCOUNT_DELETED'
  | 'ORDER_CREATED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'REFUND_PROCESSED'
  | 'ORDER_SHIPPED'
  | 'ACCOUNT_LOCKED'
  | 'CONSENT_UPDATED';

interface AuditParams {
  actorId?: string;
  actorRole?: Role;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export async function writeAudit(params: AuditParams): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      ip: params.ip,
      userAgent: params.userAgent,
    },
  });
}
