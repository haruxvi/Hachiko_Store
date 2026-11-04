import { expect, type Page } from '@playwright/test';

// Cuentas que crea el seed del Docker local (docker-compose.yml). Son de
// descarte y no existen en producción; se pueden sobrescribir por entorno.
export const SELLER = {
  email: process.env['E2E_SELLER_EMAIL'] ?? 'vendedor@hachiko.local',
  password: process.env['E2E_SELLER_PASSWORD'] ?? 'Vendedor.Local2026',
};
export const CLIENT = {
  email: process.env['E2E_CLIENT_EMAIL'] ?? 'cliente@hachiko.local',
  password: process.env['E2E_CLIENT_PASSWORD'] ?? 'Cliente.Local2026',
};

/** Deja respondido el aviso de cookies para que no tape botones en las pruebas que no son de él. */
export async function skipCookieNotice(page: Page) {
  await page.addInitScript(() => localStorage.setItem('hachiko.cookieNotice', 'v2:essential'));
}

/** Junta los errores de consola y de página para afirmar al final que no hubo ninguno. */
export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/** Inicia sesión por el formulario real y espera la respuesta de la API. */
export async function login(page: Page, account: { email: string; password: string }) {
  // networkidle: el formulario solo responde una vez hidratado
  await page.goto('/login', { waitUntil: 'networkidle' });
  // El pie también tiene un formulario (newsletter): se acota al del login
  const form = page.locator('form', { has: page.locator('input[name=password]') });
  await form.locator('input[name=email]').fill(account.email);
  await form.locator('input[name=password]').fill(account.password);
  const response = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
  await form.locator('button[type=submit]').click();
  return response;
}

/** Primer producto con stock del catálogo público (la API v1 ya filtra los inactivos). */
export async function firstProductInStock(page: Page) {
  const res = await page.request.get('/api/v1/catalog/products?limit=24');
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as {
    data: { items: { slug: string; name: string; priceCLP: number; stockState: string }[] };
  };
  const product = body.data.items.find((p) => p.stockState !== 'out');
  if (!product) throw new Error('El catálogo local no tiene productos con stock: corre el seed');
  return product;
}

/** Agrega un producto desde su ficha, como lo haría una persona. */
export async function addToCart(page: Page, slug: string) {
  await page.goto(`/producto/${slug}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Agregar al carrito/ }).click();
  await expect(page.getByText('Agregado al carrito')).toBeVisible();
}
