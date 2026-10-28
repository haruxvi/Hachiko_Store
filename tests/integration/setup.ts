import { vi } from 'vitest';

// Seguro: estos tests BORRAN tablas. Solo se permiten contra una base local.
const url = new URL(process.env['DATABASE_URL'] ?? '');
if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname)) {
  throw new Error(`Los tests de integración solo corren contra una base local, no contra ${url.hostname}.`);
}

// Fuera de Next no existe el caché de rutas: revalidateTag/revalidatePath no aplican.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
