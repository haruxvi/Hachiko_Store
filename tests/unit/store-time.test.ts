import { describe, it, expect } from 'vitest';
import { startOfStoreDay, storeDaysAgo, storeLocalToUtc } from '@/src/lib/store-time';

describe('hora de la tienda (Chile)', () => {
  it('a las 22:30 de Chile en verano (UTC-3) sigue siendo el mismo día', () => {
    // 15 de enero 2026, 22:30 en Santiago = 16 de enero 01:30 UTC
    const at = new Date('2026-01-16T01:30:00Z');
    expect(startOfStoreDay(at).toISOString()).toBe('2026-01-15T03:00:00.000Z');
  });

  it('en invierno (UTC-4) el día empieza a las 04:00 UTC', () => {
    const at = new Date('2026-07-10T15:00:00Z');
    expect(startOfStoreDay(at).toISOString()).toBe('2026-07-10T04:00:00.000Z');
  });

  it('convierte una hora de reloj de Chile a UTC', () => {
    expect(storeLocalToUtc(2026, 0, 15, 22, 30).toISOString()).toBe('2026-01-16T01:30:00.000Z');
    expect(storeLocalToUtc(2026, 6, 10, 0, 0).toISOString()).toBe('2026-07-10T04:00:00.000Z');
  });

  it('cuenta días calendario de Chile', () => {
    const at = new Date('2026-07-10T15:00:00Z');
    expect(storeDaysAgo(7, at).toISOString()).toBe('2026-07-03T04:00:00.000Z');
  });
});
