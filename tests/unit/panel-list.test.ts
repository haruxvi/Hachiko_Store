import { describe, it, expect } from 'vitest';
import {
  parseQuery,
  parsePage,
  parsePageSize,
  parseOption,
  paginate,
  pageWindow,
  hrefWith,
  matchesQuery,
} from '@/src/lib/panel-list';

describe('parámetros de las listas del panel', () => {
  it('limpia y acota el texto de búsqueda', () => {
    expect(parseQuery('  tteok   bokki ')).toBe('tteok bokki');
    expect(parseQuery(['a', 'b'])).toBe('a');
    expect(parseQuery(undefined)).toBe('');
    expect(parseQuery('x'.repeat(500))).toHaveLength(100);
  });

  it('solo acepta 10, 20, 50 o 100 por página', () => {
    expect(parsePageSize('50')).toBe(50);
    expect(parsePageSize('100')).toBe(100);
    expect(parsePageSize('5000')).toBe(20);
    expect(parsePageSize('abc')).toBe(20);
    expect(parsePageSize(undefined)).toBe(20);
  });

  it('la página es un entero positivo', () => {
    expect(parsePage('3')).toBe(3);
    expect(parsePage('0')).toBe(1);
    expect(parsePage('-2')).toBe(1);
    expect(parsePage('2.7')).toBe(2);
    expect(parsePage('NaN')).toBe(1);
    expect(parsePage('1e9')).toBe(10_000);
  });

  it('los filtros solo toman valores de la lista permitida', () => {
    const allowed = ['todos', 'activos'] as const;
    expect(parseOption('activos', allowed, 'todos')).toBe('activos');
    expect(parseOption("'; DROP TABLE", allowed, 'todos')).toBe('todos');
    expect(parseOption(undefined, allowed, 'todos')).toBe('todos');
  });
});

describe('paginate', () => {
  it('calcula el rango visible', () => {
    expect(paginate(57, 2, 20)).toMatchObject({ page: 2, totalPages: 3, skip: 20, take: 20, from: 21, to: 40 });
    expect(paginate(57, 3, 20)).toMatchObject({ from: 41, to: 57 });
  });

  it('ajusta una página que ya no existe a la última', () => {
    expect(paginate(15, 9, 10)).toMatchObject({ page: 2, skip: 10, from: 11, to: 15 });
  });

  it('sin resultados queda en la página 1 y 0–0', () => {
    expect(paginate(0, 4, 20)).toMatchObject({ page: 1, totalPages: 1, skip: 0, from: 0, to: 0 });
  });
});

describe('pageWindow', () => {
  it('muestra todas cuando son pocas', () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('abrevia con … alrededor de la página actual', () => {
    expect(pageWindow(10, 20)).toEqual([1, '…', 9, 10, 11, '…', 20]);
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, '…', 20]);
    expect(pageWindow(20, 20)).toEqual([1, '…', 17, 18, 19, 20]);
  });
});

describe('hrefWith', () => {
  it('conserva los filtros, aplica cambios y omite los vacíos', () => {
    expect(hrefWith('/p', { q: 'ramen', mostrar: '50', pagina: '3' }, { pagina: '4' })).toBe(
      '/p?q=ramen&mostrar=50&pagina=4',
    );
    expect(hrefWith('/p', { q: '', pagina: undefined })).toBe('/p');
    expect(hrefWith('/p', { q: 'a&b=c' })).toBe('/p?q=a%26b%3Dc');
  });
});

describe('matchesQuery', () => {
  it('ignora mayúsculas y tildes', () => {
    expect(matchesQuery('maria', 'María José')).toBe(true);
    expect(matchesQuery('ÑUÑOA', 'Ñuñoa')).toBe(true);
    expect(matchesQuery('1042', 1042)).toBe(true);
    expect(matchesQuery('valpo', 'Santiago', undefined)).toBe(false);
    expect(matchesQuery('', 'lo que sea')).toBe(true);
  });
});
