// Formatos chilenos. Se hace a mano (sin Intl) porque Hermes en Android no
// siempre trae los datos de locale es-CL completos.

export function clp(n: number): string {
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}$${s}`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function shortDate(iso: string | Date): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function todayTitle(d = new Date()): string {
  return `Hoy, ${DAYS[d.getDay()]} ${d.getDate()}`;
}

/** "hace 2 h", "ayer", "3 oct". */
export function relative(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return mins <= 1 ? 'recién' : `hace ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `hace ${h} h`;
  if (h < 48) return 'ayer';
  return shortDate(d);
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
