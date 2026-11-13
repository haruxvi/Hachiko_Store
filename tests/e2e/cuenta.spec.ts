import { expect, test } from '@playwright/test';
import { addToCart, firstProductInStock, skipCookieNotice } from './helpers';

test.describe('Derechos sobre los datos (Ley 21.719)', () => {
  test.beforeEach(async ({ page }) => skipCookieNotice(page));

  // Regresión: el botón era un enlace GET a /api/me/account (que solo acepta
  // DELETE) y respondía 405: la solicitud de eliminación nunca se registraba.
  test('un cliente puede solicitar la eliminación de su cuenta desde Mis datos', async ({ page }) => {
    // Cuenta propia de la prueba (invitado), para no tocar las cuentas del seed
    const product = await firstProductInStock(page);
    await addToCart(page, product.slug);
    await page.goto('/checkout', { waitUntil: 'networkidle' });
    await page.fill('#guest-email', `e2e-supresion-${Date.now()}@example.com`);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Continuar como invitado' }).click();
    await expect(page.getByRole('heading', { name: 'Terminemos esto.' })).toBeVisible();

    await page.goto('/datos', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Solicitar eliminación de cuenta →' }).click();
    await page.getByLabel('¿Por qué te vas? (opcional)').fill('Prueba automática');
    const deleted = page.waitForResponse((r) => r.url().endsWith('/api/me/account') && r.request().method() === 'DELETE');
    await page.getByRole('button', { name: 'Sí, eliminar mi cuenta' }).click();
    expect((await deleted).status()).toBe(200);
    await expect(page.getByText('Cuenta eliminada. Los datos serán purgados en 30 días.')).toBeVisible();

    // La sesión quedó cerrada: Mis datos ya no se puede abrir
    await page.waitForURL((url) => url.pathname === '/');
    await page.goto('/datos');
    await expect(page).toHaveURL(/\/login$/);
  });
});
