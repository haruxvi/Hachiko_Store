import { expect, test } from '@playwright/test';
import { CLIENT, collectErrors, login, SELLER } from './helpers';

test.describe('Trastienda y seguridad', () => {
  test('sin sesión, el panel redirige al login', async ({ page }) => {
    await page.goto('/trastienda');
    await expect(page).toHaveURL(/\/login$/);
  });

  // Con la cuenta cliente: el test siguiente entra bien con ella y eso reinicia su
  // contador de intentos fallidos (se bloquea a los 5)
  test('una contraseña incorrecta no entra y no dice si el correo existe', async ({ page }) => {
    const wrong = await login(page, { email: CLIENT.email, password: 'no-es-la-clave-123' });
    expect(wrong.status()).toBe(401);
    await expect(page).toHaveURL(/\/login$/);

    const ghost = await login(page, { email: 'nadie-e2e@example.com', password: 'no-es-la-clave-123' });
    expect(ghost.status()).toBe(401);
    expect(await ghost.json()).toEqual(await wrong.json());
  });

  test('un cliente no puede abrir el panel del vendedor', async ({ page }) => {
    expect((await login(page, CLIENT)).status()).toBe(200);
    await page.waitForURL((url) => url.pathname === '/');
    // El middleware lo manda al login y, como ya tiene sesión, el login lo devuelve al inicio
    await page.goto('/trastienda');
    await expect(page).toHaveURL((url) => url.pathname === '/');
    // Y la API del vendedor responde 401/403, no datos
    const api = await page.request.get('/api/v1/seller/products');
    expect([401, 403]).toContain(api.status());
  });

  test('vendedor: inicio, demanda con elasticidad y ficha con historial de precios', async ({ page }) => {
    const errors = collectErrors(page);
    expect((await login(page, SELLER)).status()).toBe(200);
    await page.waitForURL('**/trastienda**');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    await page.goto('/trastienda/demanda', { waitUntil: 'networkidle' });
    const elasticity = page.locator('section', { hasText: 'Elasticidad-precio' }).last();
    await expect(elasticity).toBeVisible();

    await page.goto('/trastienda/productos', { waitUntil: 'networkidle' });
    // Enlaces de edición: /trastienda/productos/<id> (no "nuevo" ni la carga masiva)
    const hrefs = await page
      .locator('a[href^="/trastienda/productos/"]')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
    const edit = hrefs.find((h) => /^\/trastienda\/productos\/[A-Za-z0-9-]{20,}$/.test(h));
    expect(edit, 'la lista de productos debería tener al menos uno').toBeTruthy();
    await page.goto(edit!, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Historial de precios' })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('cabeceras de seguridad en las respuestas HTML', async ({ request }) => {
    const res = await request.get('/');
    const h = res.headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['strict-transport-security']).toContain('max-age=');
  });
});
