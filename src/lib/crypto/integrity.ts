import { createHash } from 'node:crypto';

// Cadena de integridad para bitácoras append-only: cada evento sella el hash
// del anterior, de modo que alterar, eliminar o reordenar cualquier evento
// rompe la cadena de forma detectable.

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

export function sha256Json(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}
