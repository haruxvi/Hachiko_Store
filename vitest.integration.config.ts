import { defineConfig } from 'vitest/config';
import path from 'path';

// Tests de integración contra un Postgres REAL (no mocks): concurrencia de
// compras, confirmación de pagos y cancelaciones. Necesitan una base local
// desechable (ver "Tests de integración" en el README). Nunca apuntar a Neon:
// tests/integration/setup.ts aborta si la base no es local.
const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ?? 'postgresql://test:test@127.0.0.1:55432/hachiko_test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    // Comparten una sola base: los archivos corren uno tras otro.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
      DATA_ENCRYPTION_KEY: '0'.repeat(64),
      JWT_SECRET: 'integration-test-secret-0123456789abcdef',
      RESEND_API_KEY: '',
      RESERVATION_TTL_MINUTES: '15',
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
