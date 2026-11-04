import { describe, expect, it, vi } from 'vitest';

vi.mock('@/src/lib/db', () => ({ db: {} }));

import { arcElasticity, measureChanges, MIN_UNITS, MIN_WINDOW_DAYS, readingOf, type Sale } from '@/src/lib/services/elasticity.service';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-06-01T12:00:00Z');
const at = (days: number) => new Date(T0.getTime() + days * DAY);

/** `perDay` unidades cada día en [from, to) (días relativos a T0). */
function daily(from: number, to: number, perDay: number): Sale[] {
  const out: Sale[] = [];
  for (let d = from; d < to; d++) out.push({ at: at(d + 0.5), units: perDay });
  return out;
}

describe('Elasticidad-precio (arco)', () => {
  it('calcula la elasticidad de punto medio', () => {
    // Precio 1000 → 1100 (+9,5 % medio); ventas 10 → 8 (−22,2 % medio): e ≈ −2,33
    expect(arcElasticity(1000, 1100, 10, 8)).toBeCloseTo(-2.333, 2);
    // Subir y bajar entre los mismos puntos da la misma elasticidad.
    expect(arcElasticity(1100, 1000, 8, 10)).toBeCloseTo(arcElasticity(1000, 1100, 10, 8), 10);
  });

  it('clasifica la lectura', () => {
    expect(readingOf(-2)).toBe('elastic');
    expect(readingOf(-0.4)).toBe('inelastic');
    expect(readingOf(-1)).toBe('unit');
    expect(readingOf(0.6)).toBe('atypical');
  });

  it('mide un cambio con 28 días antes y después', () => {
    const change = { id: 'c1', createdAt: at(0), previousCLP: 1000, newCLP: 1100 };
    const sales = [...daily(-28, 0, 10), ...daily(0, 28, 8)];
    const [e] = measureChanges([change], sales, at(40));
    expect(e?.status).toBe('measured');
    if (e?.status !== 'measured') return;
    expect(e.unitsPerDayBefore).toBeCloseTo(10, 5);
    expect(e.unitsPerDayAfter).toBeCloseTo(8, 5);
    expect(e.priceChange).toBeCloseTo(0.1, 5);
    expect(e.unitsChange).toBeCloseTo(-0.2, 5);
    expect(e.elasticity).toBeCloseTo(-2.333, 2);
    expect(e.reading).toBe('elastic');
  });

  it('espera si todavía no pasan los días mínimos después del cambio', () => {
    const change = { id: 'c1', createdAt: at(0), previousCLP: 1000, newCLP: 900 };
    const [e] = measureChanges([change], daily(-28, 5, 10), at(5));
    expect(e).toMatchObject({ status: 'pending', daysLeft: MIN_WINDOW_DAYS - 5 });
  });

  it('no mide si hubo muy pocas ventas', () => {
    const change = { id: 'c1', createdAt: at(0), previousCLP: 1000, newCLP: 900 };
    const few = [{ at: at(-3), units: 2 }, { at: at(3), units: MIN_UNITS - 5 }];
    const [e] = measureChanges([change], few, at(40));
    expect(e?.status).toBe('insufficient');
  });

  it('no mezcla precios: corta las ventanas en el cambio anterior y siguiente', () => {
    const changes = [
      { id: 'a', createdAt: at(0), previousCLP: 1000, newCLP: 1200 },
      { id: 'b', createdAt: at(30), previousCLP: 1200, newCLP: 1000 },
      { id: 'c', createdAt: at(35), previousCLP: 1000, newCLP: 1300 },
    ];
    const sales = [...daily(-28, 0, 10), ...daily(0, 30, 6), ...daily(30, 35, 9), ...daily(35, 70, 5)];
    const effects = measureChanges(changes, sales, at(80));
    // Del más reciente al más antiguo.
    expect(effects.map((e) => e.id)).toEqual(['c', 'b', 'a']);
    const [c, b, a] = effects;
    // c: el precio anterior (de b) duró solo 5 días.
    expect(c?.status).toBe('insufficient');
    // b: otro cambio llegó a los 5 días, nunca se completará.
    expect(b).toMatchObject({ status: 'insufficient' });
    // a: 28 días antes (10/día) y 30 hasta b, limitado a 28 (6/día).
    expect(a?.status).toBe('measured');
    if (a?.status === 'measured') expect(a.unitsPerDayAfter).toBeCloseTo(6, 5);
  });

  it('un cambio sin variación de precio no se mide', () => {
    const [e] = measureChanges([{ id: 'x', createdAt: at(0), previousCLP: 1000, newCLP: 1000 }], [], at(40));
    expect(e?.status).toBe('insufficient');
  });
});
