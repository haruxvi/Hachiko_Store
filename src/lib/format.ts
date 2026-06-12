/** Precio en CLP con estilo de catálogo: "$ 14.900" (espacio tras el signo). */
export function formatCLP(value: number): string {
  return `$ ${value.toLocaleString('es-CL')}`;
}
