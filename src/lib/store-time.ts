// La tienda opera en Chile, pero el servidor (Vercel) corre en UTC y las fechas
// se guardan en UTC. Sin esto, "hoy" empezaba a las 21:00 (20:00 en invierno)
// hora de Chile y las ventas de la noche caían en el día siguiente.

export const STORE_TZ = 'America/Santiago';

/** Diferencia (ms) entre la hora de Santiago y UTC en ese instante (negativa: Chile va atrás). */
function offsetMs(at: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: STORE_TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .map((x) => [x.type, Number(x.value)]),
  );
  const asUtc = Date.UTC(p['year']!, p['month']! - 1, p['day']!, p['hour']!, p['minute']!, p['second']!);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Instante (UTC) en que empezó el día de hoy en Chile — o el de `at`. */
export function startOfStoreDay(at: Date = new Date()): Date {
  const local = new Date(at.getTime() + offsetMs(at));
  const midnightAsUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  // El desfase de la medianoche puede ser otro que el de ahora (cambio de horario).
  let guess = midnightAsUtc - offsetMs(new Date(midnightAsUtc));
  guess = midnightAsUtc - offsetMs(new Date(guess));
  return new Date(guess);
}

/** Una fecha y hora "de reloj" en Chile (mes 0–11) → el instante UTC correspondiente. */
export function storeLocalToUtc(year: number, month0: number, day: number, hour = 0, minute = 0): Date {
  const asUtc = Date.UTC(year, month0, day, hour, minute);
  let guess = asUtc - offsetMs(new Date(asUtc));
  guess = asUtc - offsetMs(new Date(guess));
  return new Date(guess);
}

/** `days` días atrás desde el inicio del día de hoy en Chile. */
export function storeDaysAgo(days: number, at: Date = new Date()): Date {
  const start = startOfStoreDay(at);
  // Se resta en días calendario de Chile, no en bloques de 24 h (por el cambio de horario).
  return startOfStoreDay(new Date(start.getTime() - days * 86_400_000 + 12 * 3_600_000));
}
