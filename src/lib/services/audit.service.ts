import { subDays } from 'date-fns';
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
  | 'CONSENT_UPDATED'
  | 'SECURITY_INCIDENT_CREATED'
  | 'SECURITY_INCIDENT_EVENT'
  | 'SECURITY_INCIDENT_STATUS_CHANGE'
  | 'SECURITY_INCIDENT_AUTHORITY_REPORT'
  | 'SECURITY_REPORT_EXPORTED';

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

// Ley 21.719 — limitación del plazo de conservación: la IP y el user-agent son
// datos personales, así que se conservan 12 meses (suficiente para investigar
// un incidente o respaldar una denuncia) y luego se anonimizan. El resto del
// registro (acción, fecha, tipo de objetivo) se mantiene como traza de auditoría.
export const AUDIT_PII_RETENTION_DAYS = 365;

export async function anonymizeExpiredAuditData(): Promise<{ anonymized: number }> {
  const cutoff = subDays(new Date(), AUDIT_PII_RETENTION_DAYS);
  const result = await db.auditLog.updateMany({
    where: {
      createdAt: { lt: cutoff },
      OR: [{ ip: { not: null } }, { userAgent: { not: null } }],
    },
    data: { ip: null, userAgent: null },
  });
  return { anonymized: result.count };
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
