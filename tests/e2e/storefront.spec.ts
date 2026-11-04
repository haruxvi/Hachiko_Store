import { expect, test } from '@playwright/test';
import { collectErrors, firstProductInStock, skipCookieNotice } from './helpers';

test.describe('Vitrina', () => {
  test('inicio, catálogo y ficha cargan sin errores de consola', async ({ page }) => {
    await skipCookieNotice(page);
    const errors = collectErrors(page);

    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(/Hachiko/);

    await page.goto('/catalogo', { waitUntil: 'networkidle' });
    const product = await firstProductInStock(page);
    await expect(page.locator(`a[href="/producto/${product.slug}"]`).first()).toBeVisible();

    await page.goto(`/producto/${product.slug}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1, name: product.name })).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito/ })).toBeEnabled();

    expect(errors).toEqual([]);
  });

  test('el carrito vacío invita a explorar y el que tiene productos lleva al pago', async ({ page }) => {
    await skipCookieNotice(page);
    await page.goto('/carrito', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Tu carrito está durmiendo' })).toBeVisible();

    const product = await firstProductInStock(page);
    await page.goto(`/producto/${product.slug}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Agregar uno' }).click();
    await page.getByRole('button', { name: /Agregar al carrito/ }).click();

    await page.goto('/carrito', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /Tu carrito/ })).toContainText('2 productos');
    await expect(page.getByRole('link', { name: /Proceder al pago/ })).toHaveAttribute('href', '/checkout');
  });

  test('aviso de cookies: dos opciones del mismo peso y la elección se recuerda', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const notice = page.getByRole('region', { name: 'Aviso de cookies' });
    await expect(notice).toBeVisible();

    const essential = notice.getByRole('button', { name: 'Solo esenciales' });
    const analytics = notice.getByRole('button', { name: 'Aceptar medición' });
    // Sin patrones oscuros: ambos botones comparten exactamente el mismo estilo
    expect(await essential.getAttribute('class')).toBe(await analytics.getAttribute('class'));

    await essential.click();
    await expect(notice).toBeHidden();
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('region', { name: 'Aviso de cookies' })).toHaveCount(0);
  });

  test('las páginas legales existen y una ruta inventada responde 404', async ({ page }) => {
    for (const path of ['privacidad', 'terminos', 'cookies', 'despacho', 'devoluciones']) {
      const res = await page.goto(`/legal/${path}`);
      expect(res?.status(), `/legal/${path}`).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }

    const missing = await page.goto('/esta-ruta-no-existe');
    expect(missing?.status()).toBe(404);
    await expect(page).toHaveTitle(/no encontrada/);
  });
});
