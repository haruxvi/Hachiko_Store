// Se ejecuta una vez al arrancar el servidor: valida que todas las variables
// de entorno requeridas existan antes de aceptar tráfico (falla rápido en vez
// de fallar a mitad de un pago por un secreto faltante).
export async function register() {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    await import('@/src/lib/env');
  }
}
