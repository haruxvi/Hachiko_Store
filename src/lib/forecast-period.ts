// El modelo de demanda (ml/forecast_demand.py) pronostica UNIDADES POR PERIODO
// MENSUAL (cada fila trae su largo real en `horizonDays`). Las vistas por día y
// por semana son PROMEDIOS derivados de ese pronóstico, suponiendo demanda
// uniforme dentro del mes: no son un modelo diario aparte. Por eso la escala vive
// en la capa de presentación y los servicios siguen devolviendo el dato mensual.

export type ForecastPeriod = 'day' | 'week' | 'month';
export const FORECAST_PERIODS: readonly ForecastPeriod[] = ['day', 'week', 'month'];

// Valores de query string no reconocidos (o ausentes) caen a la vista mensual.
export function parsePeriod(value: string | undefined): ForecastPeriod {
  return FORECAST_PERIODS.includes(value as ForecastPeriod) ? (value as ForecastPeriod) : 'month';
}

// Lleva una cantidad del período pronosticado (horizonDays días) al período pedido.
export function scaleToPeriod(qty: number, period: ForecastPeriod, horizonDays: number): number {
  if (period === 'month') return qty;
  const days = horizonDays > 0 ? horizonDays : 30;
  return period === 'day' ? qty / days : (qty * 7) / days;
}

// Mes: enteros. Día/semana: un decimal, porque redondear a entero un promedio
// diario borra la diferencia entre productos (0,6 y 1,4 quedarían ambos en 1).
export function formatUnits(qty: number, period: ForecastPeriod): string {
  return period === 'month'
    ? Math.round(qty).toLocaleString('es-CL')
    : qty.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
