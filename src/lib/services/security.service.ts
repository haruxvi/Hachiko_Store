import { subDays } from 'date-fns';
import { computeEventHash, verifyChain, sha256Json } from '@/src/lib/crypto/integrity';
import { db } from '@/src/lib/db';
import type {
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  IncidentEventType,
  Prisma,
} from '@prisma/client';

// ─── Panel de monitoreo (solo lectura sobre AuditLog) ────────

// Acciones del AuditLog relevantes para seguridad — el panel nunca expone
// el detalle de clientes, solo conteos y eventos ya anonimizados en metadata
const SECURITY_ACTIONS = [
  'LOGIN_FAILED',
  'ACCOUNT_LOCKED',
  'ROLE_CHANGE',
  'DATA_EXPORT',
  'ACCOUNT_DELETE_REQUEST',
  'ACCOUNT_DELETED',
  'CONSENT_UPDATED',
] as const;

export async function getSecurityOverview() {
  const now = new Date();
  const last24h = subDays(now, 1);
  const last7d = subDays(now, 7);

  const [
    failedLogins24h,
    failedLogins7d,
    lockouts7d,
    lockedAccountsNow,
    openIncidents,
    criticalIncidents,
    pendingDeletionRequests,
    pendingExportRequests,
  ] = await Promise.all([
    db.auditLog.count({ where: { action: 'LOGIN_FAILED', createdAt: { gte: last24h } } }),
    db.auditLog.count({ where: { action: 'LOGIN_FAILED', createdAt: { gte: last7d } } }),
    db.auditLog.count({ where: { action: 'ACCOUNT_LOCKED', createdAt: { gte: last7d } } }),
    db.user.count({ where: { lockedUntil: { gt: now } } }),
    db.securityIncident.count({ where: { status: { in: ['OPEN', 'INVESTIGATING', 'CONTAINED'] } } }),
    db.securityIncident.count({
      where: { severity: 'CRITICAL', status: { notIn: ['RESOLVED', 'CLOSED'] } },
    }),
    db.deletionRequest.count({ where: { executedAt: null } }),
    db.dataExportRequest.count({ where: { completedAt: null } }),
  ]);

  return {
    failedLogins24h,
    failedLogins7d,
    lockouts7d,
    lockedAccountsNow,
    openIncidents,
    criticalIncidents,
    pendingDeletionRequests,
    pendingExportRequests,
  };
}

export async function getRecentSecurityEvents(limit = 30) {
  return db.auditLog.findMany({
    where: { action: { in: [...SECURITY_ACTIONS] } },
    select: {
      id: true,
      action: true,
      actorRole: true,
      targetType: true,
      ip: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ─── Incidencias (append-only, encadenadas por hash) ─────────

async function appendEvent(
  tx: Prisma.TransactionClient,
  params: { incidentId: string; type: IncidentEventType; detail: string; actorId: string },
) {
  const last = await tx.securityIncidentEvent.findFirst({
    where: { incidentId: params.incidentId },
    orderBy: { seq: 'desc' },
    select: { seq: true, hash: true },
  });

  const seq = (last?.seq ?? 0) + 1;
  const prevHash = last?.hash ?? null;
  const createdAt = new Date();

  return tx.securityIncidentEvent.create({
    data: {
      incidentId: params.incidentId,
      seq,
      type: params.type,
      detail: params.detail,
      actorId: params.actorId,
      prevHash,
      createdAt,
      hash: computeEventHash({ ...params, seq, prevHash, createdAt }),
    },
  });
}

export interface CreateIncidentInput {
  title: string;
  description: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  detectedAt: Date;
  affectsPersonalData: boolean;
  affectedUsersEstimate?: number;
  actorId: string;
}

export async function createIncident(input: CreateIncidentInput) {
  return db.$transaction(async (tx) => {
    const incident = await tx.securityIncident.create({
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        severity: input.severity,
        detectedAt: input.detectedAt,
        affectsPersonalData: input.affectsPersonalData,
        affectedUsersEstimate: input.affectedUsersEstimate,
        reportedBy: input.actorId,
      },
    });
    await appendEvent(tx, {
      incidentId: incident.id,
      type: 'CREATED',
      detail: `Incidencia registrada: ${input.title}`,
      actorId: input.actorId,
    });
    return incident;
  });
}

export async function addIncidentNote(params: {
  incidentId: string;
  detail: string;
  actorId: string;
  type?: Extract<IncidentEventType, 'NOTE' | 'EVIDENCE'>;
}) {
  return db.$transaction((tx) =>
    appendEvent(tx, {
      incidentId: params.incidentId,
      type: params.type ?? 'NOTE',
      detail: params.detail,
      actorId: params.actorId,
    }),
  );
}

const STATUS_FLOW: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ['INVESTIGATING', 'CONTAINED', 'REPORTED', 'RESOLVED'],
  INVESTIGATING: ['CONTAINED', 'REPORTED', 'RESOLVED'],
  CONTAINED: ['INVESTIGATING', 'REPORTED', 'RESOLVED'],
  REPORTED: ['INVESTIGATING', 'CONTAINED', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'INVESTIGATING'],
  CLOSED: [],
};

export async function changeIncidentStatus(params: {
  incidentId: string;
  newStatus: IncidentStatus;
  detail: string;
  actorId: string;
}) {
  return db.$transaction(async (tx) => {
    const incident = await tx.securityIncident.findUniqueOrThrow({
      where: { id: params.incidentId },
      select: { status: true },
    });

    if (!STATUS_FLOW[incident.status].includes(params.newStatus)) {
      throw new Error(`Transición no permitida: ${incident.status} → ${params.newStatus}`);
    }

    await tx.securityIncident.update({
      where: { id: params.incidentId },
      data: {
        status: params.newStatus,
        resolvedAt: params.newStatus === 'RESOLVED' ? new Date() : undefined,
      },
    });

    return appendEvent(tx, {
      incidentId: params.incidentId,
      type: 'STATUS_CHANGE',
      detail: `${incident.status} → ${params.newStatus}. ${params.detail}`,
      actorId: params.actorId,
    });
  });
}

export async function registerAuthorityReport(params: {
  incidentId: string;
  authorityName: string;
  reportRef: string;
  actorId: string;
}) {
  return db.$transaction(async (tx) => {
    await tx.securityIncident.update({
      where: { id: params.incidentId },
      data: {
        authorityName: params.authorityName,
        authorityReportRef: params.reportRef,
        authorityNotifiedAt: new Date(),
        status: 'REPORTED',
      },
    });
    return appendEvent(tx, {
      incidentId: params.incidentId,
      type: 'AUTHORITY_REPORT',
      detail: `Notificado a ${params.authorityName} — referencia ${params.reportRef}`,
      actorId: params.actorId,
    });
  });
}

export async function listIncidents() {
  return db.securityIncident.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      incidentNumber: true,
      title: true,
      category: true,
      severity: true,
      status: true,
      affectsPersonalData: true,
      detectedAt: true,
      createdAt: true,
    },
  });
}

export async function getIncident(id: string) {
  return db.securityIncident.findUnique({
    where: { id },
    include: { events: { orderBy: { seq: 'asc' } } },
  });
}

// ─── Verificación de integridad y exportación ────────────────

export const verifyIncidentChain = verifyChain;

// Informe autocontenido para autoridades (Agencia de Protección de Datos,
// CSIRT Nacional, PDI Cibercrimen, Fiscalía). No incluye datos personales de
// clientes — solo la incidencia, su bitácora y la prueba de integridad.
export async function buildIncidentReport(incidentId: string) {
  const incident = await getIncident(incidentId);
  if (!incident) return null;

  const chain = verifyIncidentChain(incident.events);

  const body = {
    formato: 'hachiko-incident-report/1',
    generadoEl: new Date().toISOString(),
    marcoLegal: [
      'Ley 21.663 — Marco de Ciberseguridad e Infraestructura Crítica',
      'Ley 21.459 — Delitos Informáticos',
      'Ley 21.719 — Protección de Datos Personales',
    ],
    incidencia: {
      numero: incident.incidentNumber,
      titulo: incident.title,
      descripcion: incident.description,
      categoria: incident.category,
      severidad: incident.severity,
      estado: incident.status,
      detectadaEl: incident.detectedAt.toISOString(),
      afectaDatosPersonales: incident.affectsPersonalData,
      usuariosAfectadosEstimados: incident.affectedUsersEstimate,
      autoridadNotificada: incident.authorityName,
      referenciaDenuncia: incident.authorityReportRef,
      notificadaEl: incident.authorityNotifiedAt?.toISOString() ?? null,
      registradaEl: incident.createdAt.toISOString(),
      resueltaEl: incident.resolvedAt?.toISOString() ?? null,
    },
    bitacora: incident.events.map((ev) => ({
      seq: ev.seq,
      tipo: ev.type,
      detalle: ev.detail,
      fecha: ev.createdAt.toISOString(),
      hashPrevio: ev.prevHash,
      hash: ev.hash,
    })),
    integridad: {
      algoritmo: 'SHA-256 encadenado (cada evento sella el hash del anterior)',
      cadenaValida: chain.valid,
      rotaEnSecuencia: chain.brokenAtSeq,
    },
  };

  // Sello del documento completo: permite a la autoridad verificar que el
  // archivo recibido no fue alterado después de generarse
  return { ...body, selloDocumento: sha256Json(body) };
}
