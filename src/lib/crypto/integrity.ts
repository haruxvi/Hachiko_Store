import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Cadena de integridad para bitácoras append-only en dos capas:
//  1. Cada evento guarda el SHA-256 del anterior (sin clave): cualquiera, también
//     una autoridad que recibe la exportación, puede recalcular la cadena.
//  2. La incidencia guarda un SELLO de la cabeza (cuántos eventos hay y el hash
//     del último), firmado con HMAC-SHA256 y una clave que no vive en la base.
// La capa 1 sola no basta: quien puede escribir en la base podría alterar un
// evento y recalcular todos los hashes, o borrar los últimos eventos sin romper
// nada. Con el sello, cualquiera de esas maniobras deja una cabeza que no
// coincide, y sin la clave no se puede volver a sellar.

export interface ChainedEvent {
  incidentId: string;
  seq: number;
  type: string;
  detail: string;
  actorId: string;
  createdAt: Date;
  prevHash: string | null;
}

export function computeEventHash(input: ChainedEvent): string {
  const canonical = [
    input.incidentId,
    String(input.seq),
    input.type,
    input.detail,
    input.actorId,
    input.createdAt.toISOString(),
    input.prevHash ?? '',
  ].join('|');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function verifyChain(
  events: Array<ChainedEvent & { hash: string }>,
): { valid: boolean; brokenAtSeq: number | null } {
  let prevHash: string | null = null;
  for (const ev of events) {
    if (ev.prevHash !== prevHash || ev.hash !== computeEventHash(ev)) {
      return { valid: false, brokenAtSeq: ev.seq };
    }
    prevHash = ev.hash;
  }
  return { valid: true, brokenAtSeq: null };
}

// ─── Sello de la cabeza (HMAC) ───────────────────────────────

// Clave derivada de DATA_ENCRYPTION_KEY, que vive en el entorno y nunca en la
// base. La etiqueta separa usos: el sello no sirve para nada más y no hay una
// variable nueva que configurar en cada despliegue.
function sealKey(): Buffer {
  const hex = process.env['DATA_ENCRYPTION_KEY'] ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  return createHmac('sha256', Buffer.from(hex, 'hex')).update('hachiko:incident-chain-seal:v1').digest();
}

/** Sello de una cabeza: incidencia, largo de la bitácora y hash del último evento. */
export function sealChainHead(incidentId: string, length: number, headHash: string | null): string {
  return createHmac('sha256', sealKey())
    .update(JSON.stringify(['incident-head', incidentId, length, headHash]))
    .digest('hex');
}

export interface ChainHead {
  id: string;
  chainLength: number;
  chainHead: string | null;
  chainSeal: string | null;
}

/** El sello guardado corresponde a esa cabeza (comparación en tiempo constante). */
export function isHeadSealed(head: ChainHead): boolean {
  if (!head.chainSeal) return false;
  const expected = Buffer.from(sealChainHead(head.id, head.chainLength, head.chainHead), 'hex');
  const given = Buffer.from(head.chainSeal, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type IntegrityStatus = 'VALID' | 'BROKEN' | 'UNSEALED';

export interface IntegrityResult {
  status: IntegrityStatus;
  valid: boolean;
  brokenAtSeq: number | null;
  reason: string | null;
}

/**
 * Verificación completa de una incidencia: la cadena de eventos (capa 1) y que
 * su largo y su último hash sean los que la tienda selló con su clave (capa 2).
 */
export function verifyIncidentIntegrity(
  head: ChainHead,
  events: Array<ChainedEvent & { hash: string }>,
): IntegrityResult {
  const broken = (brokenAtSeq: number | null, reason: string): IntegrityResult => ({
    status: 'BROKEN',
    valid: false,
    brokenAtSeq,
    reason,
  });

  const chain = verifyChain(events);
  if (!chain.valid) return broken(chain.brokenAtSeq, 'Un evento fue alterado o falta un evento intermedio.');

  if (!head.chainSeal) {
    return {
      status: 'UNSEALED',
      valid: false,
      brokenAtSeq: null,
      reason: 'La incidencia no tiene sello con clave (registrada antes del sellado, o se lo quitaron).',
    };
  }
  if (!isHeadSealed(head)) return broken(null, 'El sello no corresponde: el registro de la incidencia fue alterado.');

  const lastHash = events.length ? events[events.length - 1]!.hash : null;
  if (events.length < head.chainLength) {
    return broken(events.length + 1, `Faltan ${head.chainLength - events.length} evento(s) al final de la bitácora.`);
  }
  if (events.length > head.chainLength) {
    return broken(head.chainLength + 1, 'Hay eventos agregados por fuera de la aplicación (sin sello).');
  }
  if (lastHash !== head.chainHead) return broken(null, 'La bitácora fue reescrita: no coincide con su sello.');

  return { status: 'VALID', valid: true, brokenAtSeq: null, reason: null };
}

export function sha256Json(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}
