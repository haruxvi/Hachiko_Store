import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeEventHash,
  isHeadSealed,
  sealChainHead,
  verifyChain,
  verifyIncidentIntegrity,
  type ChainedEvent,
  type ChainHead,
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

describe('Sello con clave de la cabeza (lo que la cadena sola no detecta)', () => {
  const KEY = 'b'.repeat(64);
  beforeEach(() => {
    process.env['DATA_ENCRYPTION_KEY'] = KEY; // 32 bytes, solo para pruebas
  });

  const sealed = (events: Array<ChainedEvent & { hash: string }>): ChainHead => {
    const head = events.length ? events[events.length - 1]!.hash : null;
    return { id: 'inc_1', chainLength: events.length, chainHead: head, chainSeal: sealChainHead('inc_1', events.length, head) };
  };

  /** Lo que haría alguien con acceso a la base: reescribir y recalcular TODA la cadena. */
  const rechain = (events: Array<ChainedEvent & { hash: string }>) => {
    let prevHash: string | null = null;
    return events.map((ev) => {
      const next = { ...ev, prevHash };
      const hash = computeEventHash(next);
      prevHash = hash;
      return { ...next, hash };
    });
  };

  it('bitácora íntegra y sellada → VALID', () => {
    const chain = buildChain(['Incidencia registrada', 'Nota 1', 'Nota 2']);
    expect(verifyIncidentIntegrity(sealed(chain), chain)).toMatchObject({ status: 'VALID', valid: true });
  });

  it('evento alterado con TODA la cadena recalculada → BROKEN (antes pasaba)', () => {
    const chain = buildChain(['Incidencia registrada', 'Nota 1', 'Nota 2']);
    const head = sealed(chain);
    const forged = rechain(chain.map((ev, i) => (i === 1 ? { ...ev, detail: 'Nota 1 adulterada' } : ev)));
    expect(verifyChain(forged).valid).toBe(true); // la cadena sola no lo nota
    expect(verifyIncidentIntegrity(head, forged)).toMatchObject({ status: 'BROKEN', valid: false });
  });

  it('últimos eventos borrados → BROKEN (antes pasaba)', () => {
    const chain = buildChain(['Incidencia registrada', 'Nota 1', 'Nota 2']);
    const truncated = chain.slice(0, 2);
    expect(verifyChain(truncated).valid).toBe(true);
    expect(verifyIncidentIntegrity(sealed(chain), truncated)).toMatchObject({ status: 'BROKEN', brokenAtSeq: 3 });
  });

  it('evento agregado por fuera de la aplicación → BROKEN', () => {
    const chain = buildChain(['Incidencia registrada', 'Nota 1']);
    const head = sealed(chain);
    const extended = rechain([...chain, { ...chain[1]!, seq: 3, detail: 'Nota falsa' }]);
    expect(verifyIncidentIntegrity(head, extended)).toMatchObject({ status: 'BROKEN', brokenAtSeq: 3 });
  });

  it('cabeza movida a mano sin la clave → BROKEN', () => {
    const chain = buildChain(['Incidencia registrada', 'Nota 1', 'Nota 2']);
    const truncated = chain.slice(0, 2);
    // El atacante ajusta largo y último hash, pero copia el sello viejo
    const head = { ...sealed(chain), chainLength: 2, chainHead: truncated[1]!.hash };
    expect(verifyIncidentIntegrity(head, truncated)).toMatchObject({ status: 'BROKEN', valid: false });
  });

  it('sello calculado con otra clave → BROKEN', () => {
    const chain = buildChain(['Incidencia registrada']);
    const head = sealed(chain);
    process.env['DATA_ENCRYPTION_KEY'] = 'c'.repeat(64);
    expect(verifyIncidentIntegrity(head, chain)).toMatchObject({ status: 'BROKEN' });
  });

  it('sin sello → UNSEALED, nunca VALID', () => {
    const chain = buildChain(['Incidencia registrada']);
    const head = { ...sealed(chain), chainSeal: null };
    expect(isHeadSealed(head)).toBe(false);
    expect(verifyIncidentIntegrity(head, chain)).toMatchObject({ status: 'UNSEALED', valid: false });
  });
});
