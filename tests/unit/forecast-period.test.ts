import { describe, it, expect } from 'vitest';
import { parsePeriod, scaleToPeriod, formatUnits } from '@/src/lib/forecast-period';

describe('parsePeriod', () => {
  it('acepta los tres períodos válidos', () => {
    expect(parsePeriod('day')).toBe('day');
    expect(parsePeriod('week')).toBe('week');
    expect(parsePeriod('month')).toBe('month');
  });

  it('cae a "month" con valores ausentes o manipulados en la URL', () => {
    expect(parsePeriod(undefined)).toBe('month');
    expect(parsePeriod('')).toBe('month');
    expect(parsePeriod('year')).toBe('month');
    expect(parsePeriod('<script>')).toBe('month');
  });
});

describe('scaleToPeriod', () => {
  it('no altera el valor mensual', () => {
    expect(scaleToPeriod(310, 'month', 31)).toBe(310);
  });

  it('usa el largo real del período (horizonDays), no 30 fijo', () => {
    expect(scaleToPeriod(310, 'day', 31)).toBe(10);
    expect(scaleToPeriod(300, 'day', 30)).toBe(10);
    expect(scaleToPeriod(310, 'week', 31)).toBe(70);
  });

  it('cae a 30 días si horizonDays es inválido', () => {
    expect(scaleToPeriod(300, 'day', 0)).toBe(10);
  });

  it('es lineal: escalar el total equivale a sumar lo escalado', () => {
    const qtys = [44, 17, 90];
    const sumScaled = qtys.reduce((a, q) => a + scaleToPeriod(q, 'week', 31), 0);
    expect(sumScaled).toBeCloseTo(scaleToPeriod(44 + 17 + 90, 'week', 31));
  });
});

describe('formatUnits', () => {
  it('muestra enteros en la vista mensual', () => {
    expect(formatUnits(1234.6, 'month')).toBe('1.235');
  });

  it('muestra un decimal en día/semana para no aplastar promedios bajos a 0 o 1', () => {
    expect(formatUnits(0.6, 'day')).toBe('0,6');
    expect(formatUnits(1.44, 'week')).toBe('1,4');
  });
});
