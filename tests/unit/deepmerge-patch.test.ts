import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// Copia parchada que usa la app (mobile/vendor/deepmerge): debe cerrar el
// prototype poisoning (GHSA-gcqx-w48m-w2h4) sin cambiar el resto del comportamiento.
const require = createRequire(import.meta.url);
type Merge = (<T>(a: object, b: object, options?: object) => T) & { all: (objs: object[]) => object };
const deepmerge = require('../../mobile/vendor/deepmerge/index.js') as Merge;

const evil = () => JSON.parse('{"__proto__": {"isAdmin": true}, "name": "x"}');

describe('deepmerge parchado (app móvil)', () => {
  it('un "__proto__" en el destino ya no cambia el prototipo del resultado', () => {
    const out = deepmerge<Record<string, unknown>>(evil(), {});
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(out['isAdmin']).toBeUndefined();
    expect(out['name']).toBe('x');
  });

  it('tampoco desde el origen, aunque el destino no tenga prototipo', () => {
    const out = deepmerge<Record<string, unknown>>(Object.create(null), evil());
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(out['isAdmin']).toBeUndefined();
  });

  it('no contamina Object.prototype', () => {
    deepmerge(evil(), evil());
    expect(({} as Record<string, unknown>)['isAdmin']).toBeUndefined();
  });

  it('sigue mezclando igual que deepmerge 4.3.1 (objetos anidados, arreglos, all)', () => {
    expect(deepmerge({ a: 1, n: { x: 1 }, list: [1] }, { b: 2, n: { y: 2 }, list: [2] })).toEqual({
      a: 1,
      b: 2,
      n: { x: 1, y: 2 },
      list: [1, 2],
    });
    expect(deepmerge.all([{ a: 1 }, { b: 2 }, { a: 3 }])).toEqual({ a: 3, b: 2 });
    const plugin = deepmerge<{ props: { x: number } }>({ props: { x: 1 } }, { props: { x: 2 } });
    expect(plugin.props.x).toBe(2);
  });
});
