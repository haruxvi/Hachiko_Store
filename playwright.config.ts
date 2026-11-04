import { defineConfig, devices } from '@playwright/test';

// Pruebas end-to-end contra una instancia YA levantada de la tienda
// (Docker local: `docker compose up -d --build`). Crean pedidos e invitados de
// prueba, así que por defecto se niegan a correr contra algo que no sea local.
const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000';
const host = new URL(baseURL).hostname;
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(host) || host.endsWith('.localhost');
if (!isLocal && process.env['E2E_ALLOW_REMOTE'] !== '1') {
  throw new Error(
    `E2E_BASE_URL apunta a ${host}: las pruebas e2e crean pedidos. ` +
      'Úsalas contra el Docker local o define E2E_ALLOW_REMOTE=1 si es un ambiente de pruebas.',
  );
}

export default defineConfig({
  testDir: 'tests/e2e',
  // Un solo worker: los flujos comparten cuentas del seed y el límite de intentos por IP
  workers: 1,
  fullyParallel: false,
  retries: process.env['CI'] ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    // La vitrina también se recorre en un teléfono; el panel y el pago, solo en escritorio
    { name: 'movil', use: { ...devices['Pixel 7'] }, testMatch: /storefront\.spec\.ts/ },
  ],
});
