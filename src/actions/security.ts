'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/src/lib/auth/session';
import { writeAudit } from '@/src/lib/services/audit.service';
import {
  createIncident,
  addIncidentNote,
  changeIncidentStatus,
  registerAuthorityReport,
} from '@/src/lib/services/security.service';

// ─── Crear incidencia ────────────────────────────────────────

const CreateIncidentSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  category: z.enum([
    'SYSTEM_INTEGRITY_ATTACK',
    'UNAUTHORIZED_ACCESS',
    'ILLEGAL_INTERCEPTION',
    'DATA_INTEGRITY_ATTACK',
    'COMPUTER_FRAUD',
    'PERSONAL_DATA_BREACH',
    'PHISHING_IMPERSONATION',
    'CREDENTIAL_ABUSE',
    'OTHER',
  ]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  detectedAt: z.coerce
    .date()
    .refine((d) => d.getTime() <= Date.now(), 'La fecha de detección no puede ser futura'),
  affectsPersonalData: z.boolean().default(false),
  affectedUsersEstimate: z.number().int().min(0).optional(),
});

export async function createIncidentAction(
  input: z.infer<typeof CreateIncidentSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') {
    return { ok: false, error: 'Sin permisos' };
  }

  const parsed = CreateIncidentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  try {
    const incident = await createIncident({ ...parsed.data, actorId: session.sub });
    await writeAudit({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SECURITY_INCIDENT_CREATED',
      targetType: 'SecurityIncident',
      targetId: incident.id,
      metadata: { category: parsed.data.category, severity: parsed.data.severity },
    });
    revalidatePath('/trastienda/seguridad');
    return { ok: true, id: incident.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al registrar incidencia' };
  }
}

// ─── Agregar nota o evidencia a la bitácora ──────────────────

const AddNoteSchema = z.object({
  incidentId: z.string().cuid(),
  detail: z.string().min(3).max(2000),
  type: z.enum(['NOTE', 'EVIDENCE']).default('NOTE'),
});

export async function addIncidentNoteAction(
  input: z.infer<typeof AddNoteSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') {
    return { ok: false, error: 'Sin permisos' };
  }

  const parsed = AddNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  try {
    await addIncidentNote({ ...parsed.data, actorId: session.sub });
    await writeAudit({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SECURITY_INCIDENT_EVENT',
      targetType: 'SecurityIncident',
      targetId: parsed.data.incidentId,
      metadata: { type: parsed.data.type },
    });
    revalidatePath(`/trastienda/seguridad/${parsed.data.incidentId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al agregar a la bitácora' };
  }
}

// ─── Cambiar estado ──────────────────────────────────────────

const ChangeStatusSchema = z.object({
  incidentId: z.string().cuid(),
  newStatus: z.enum(['OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'REPORTED', 'CLOSED']),
  detail: z.string().min(3).max(1000),
});

export async function changeIncidentStatusAction(
  input: z.infer<typeof ChangeStatusSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') {
    return { ok: false, error: 'Sin permisos' };
  }

  const parsed = ChangeStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  try {
    await changeIncidentStatus({ ...parsed.data, actorId: session.sub });
    await writeAudit({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SECURITY_INCIDENT_STATUS_CHANGE',
      targetType: 'SecurityIncident',
      targetId: parsed.data.incidentId,
      metadata: { newStatus: parsed.data.newStatus },
    });
    revalidatePath(`/trastienda/seguridad/${parsed.data.incidentId}`);
    revalidatePath('/trastienda/seguridad');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al cambiar estado' };
  }
}

// ─── Registrar denuncia / notificación a autoridad ───────────

const AuthorityReportSchema = z.object({
  incidentId: z.string().cuid(),
  authorityName: z.string().min(3).max(200),
  reportRef: z.string().min(1).max(200),
});

export async function registerAuthorityReportAction(
  input: z.infer<typeof AuthorityReportSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') {
    return { ok: false, error: 'Sin permisos' };
  }

  const parsed = AuthorityReportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  try {
    await registerAuthorityReport({ ...parsed.data, actorId: session.sub });
    await writeAudit({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SECURITY_INCIDENT_AUTHORITY_REPORT',
      targetType: 'SecurityIncident',
      targetId: parsed.data.incidentId,
      metadata: { authorityName: parsed.data.authorityName },
    });
    revalidatePath(`/trastienda/seguridad/${parsed.data.incidentId}`);
    revalidatePath('/trastienda/seguridad');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al registrar denuncia' };
  }
}
