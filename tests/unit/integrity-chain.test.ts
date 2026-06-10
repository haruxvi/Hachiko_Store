import { describe, it, expect } from 'vitest';
import {
  computeEventHash,
  verifyChain,
  type ChainedEvent,
} from '@/src/lib/crypto/integrity';

function buildChain(details: string[]): Array<ChainedEvent & { hash: string }> {
  const events: Array<ChainedEvent & { hash: string }> = [];
  let prevHash: string | null = null;

  details.forEach((detail, i) => {
    const ev: ChainedEvent = {
      incidentId: 'inc_1',
      seq: i + 1,
      type: i === 0 ? 'CREATED' : 'NOTE',
      detail,
      actorId: 'user_1',
      createdAt: new Date(2026, 5, 10, 12, i),
      prevHash,
    };
    const hash = computeEventHash(ev);
    events.push({ ...ev, hash });
    prevHash = hash;
  });

  return events;
}

describe('Cadena de integridad de bitácora de incidencias', () => {
  it('valida una cadena íntegra', () => {
    const chain = buildChain(['Incidencia registrada', 'Nota 1', 'Nota 2']);
    expect(verifyChain(chain)).toEqual({ valid: true, brokenAtSeq: null });
  });

  it('valida una cadena vacía', () => {
    expect(verifyChain([])).toEqual({ valid: true, brokenAtSeq: null });
  });

  it('detecta la alteración del contenido de un evento', () => {
    const chain = buildChain(['Incidencia registrada', 'Nota 1', 'Nota 2']);
    chain[1] = { ...chain[1]!, detail: 'Nota 1 adulterada' };
    expect(verifyChain(chain)).toEqual({ valid: false, brokenAtSeq: 2 });
  });

  it('detecta la eliminación de un evento intermedio', () => {
    const chain = buildChain(['Incidencia registrada', 'Nota 1', 'Nota 2']);
    const tampered = [chain[0]!, chain[2]!];
    expect(verifyChain(tampered).valid).toBe(false);
  });

  it('detecta el reordenamiento de eventos', () => {
    const chain = buildChain(['Incidencia registrada', 'Nota 1', 'Nota 2']);
    const tampered = [chain[0]!, chain[2]!, chain[1]!];
    expect(verifyChain(tampered).valid).toBe(false);
  });

  it('detecta un hash recalculado sin reencadenar el resto', () => {
    const chain = buildChain(['Incidencia registrada', 'Nota 1', 'Nota 2']);
    const altered = { ...chain[1]!, detail: 'Nota 1 adulterada' };
    altered.hash = computeEventHash(altered);
    chain[1] = altered;
    // El evento 2 ahora es internamente consistente, pero el 3 sigue
    // apuntando al hash original — la cadena se rompe en el siguiente eslabón
    expect(verifyChain(chain)).toEqual({ valid: false, brokenAtSeq: 3 });
  });
});
