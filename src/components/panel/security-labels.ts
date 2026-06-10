import type {
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  IncidentEventType,
} from '@prisma/client';

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  SYSTEM_INTEGRITY_ATTACK: 'Ataque a integridad del sistema (Art. 1, Ley 21.459)',
  UNAUTHORIZED_ACCESS: 'Acceso ilícito (Art. 2, Ley 21.459)',
  ILLEGAL_INTERCEPTION: 'Interceptación ilícita (Art. 3, Ley 21.459)',
  DATA_INTEGRITY_ATTACK: 'Ataque a integridad de datos (Art. 4, Ley 21.459)',
  COMPUTER_FRAUD: 'Fraude informático (Art. 7, Ley 21.459)',
  PERSONAL_DATA_BREACH: 'Vulneración de datos personales (Ley 21.719)',
  PHISHING_IMPERSONATION: 'Phishing / suplantación',
  CREDENTIAL_ABUSE: 'Abuso de credenciales (fuerza bruta)',
  OTHER: 'Otro',
};

export const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Abierta',
  INVESTIGATING: 'En investigación',
  CONTAINED: 'Contenida',
  RESOLVED: 'Resuelta',
  REPORTED: 'Denunciada a autoridad',
  CLOSED: 'Cerrada',
};

export const EVENT_TYPE_LABELS: Record<IncidentEventType, string> = {
  CREATED: 'Registro',
  NOTE: 'Nota',
  STATUS_CHANGE: 'Cambio de estado',
  AUTHORITY_REPORT: 'Denuncia a autoridad',
  EVIDENCE: 'Evidencia',
};

export const SEVERITY_BADGE: Record<IncidentSeverity, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export const STATUS_BADGE: Record<IncidentStatus, string> = {
  OPEN: 'bg-red-50 text-red-700',
  INVESTIGATING: 'bg-amber-50 text-amber-700',
  CONTAINED: 'bg-blue-50 text-blue-700',
  RESOLVED: 'bg-emerald-50 text-emerald-700',
  REPORTED: 'bg-purple-50 text-purple-700',
  CLOSED: 'bg-gray-100 text-gray-500',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN_FAILED: 'Intento de login fallido',
  ACCOUNT_LOCKED: 'Cuenta bloqueada por intentos',
  ROLE_CHANGE: 'Cambio de rol',
  DATA_EXPORT: 'Exportación de datos (ARCO)',
  ACCOUNT_DELETE_REQUEST: 'Solicitud de eliminación',
  ACCOUNT_DELETED: 'Cuenta eliminada',
  CONSENT_UPDATED: 'Consentimiento actualizado',
};
