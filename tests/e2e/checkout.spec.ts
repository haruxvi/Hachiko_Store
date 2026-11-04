import { expect, test, type Page } from '@playwright/test';
import { addToCart, CLIENT, firstProductInStock, login, skipCookieNotice } from './helpers';

// El flujo de compra completo hasta el momento de pagar. Por defecto la
// llamada a Webpay se intercepta: se comprueba que la orden quedó creada sin
// salir a Transbank. Con E2E_PAYMENTS=1 se deja seguir hasta el formulario de
// pago del ambiente de integración de Transbank (requiere internet).
const realPayments = process.env['E2E_PAYMENTS'] === '1';

async function payWithWebpay(page: Page) {
  if (!realPayments) {
    await page.route('**/api/payments/webpay/create', (route) =>
      route.fulfill({ json: { ok: false, error: { code: 'E2E', message: 'interceptado por la prueba' } } }),
    );
  }
  const created = page.waitForRequest('**/api/payments/webpay/create');
  await page.getByText('Webpay Plus', { exact: true }).click();
  await page.getByRole('button', { name: /^Pagar \$/ }).click();
  const request = await created;
  const { orderId } = request.postDataJSON() as { orderId: string };
  expect(orderId).toBeTruthy();

  if (realPayments) {
    await page.waitForURL(/webpay3gint\.transbank\.cl/, { timeout: 30_000 });
  }
  return orderId;
}

test.describe('Compra', () => {
  test.beforeEach(async ({ page }) => skipCookieNotice(page));

  test('invitado: retiro en tienda y la orden se crea antes de ir a Webpay', async ({ page }) => {
    const product = await firstProductInStock(page);
    await addToCart(page, product.slug);

    await page.goto('/checkout', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Antes de pagar' })).toBeVisible();
    await page.fill('#guest-email', `e2e-${Date.now()}@example.com`);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Continuar como invitado' }).click();

    await expect(page.getByRole('heading', { name: 'Terminemos esto.' })).toBeVisible();
    await page.getByText('Retiro en tienda', { exact: true }).click();
    // Retiro: no se piden calle ni comuna
    await expect(page.locator('#street')).toHaveCount(0);
    await page.fill('#fullName', 'Prueba E2E');
    await page.fill('#phone', '+56 9 1234 5678');

    await payWithWebpay(page);
  });

  test('cliente con cuenta: el despacho exige dirección y valida el teléfono', async ({ page }) => {
    const res = await login(page, CLIENT);
    expect(res.status()).toBe(200);
    await page.waitForURL((url) => url.pathname === '/');

    const product = await firstProductInStock(page);
    await addToCart(page, product.slug);
    await page.goto('/checkout', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Terminemos esto.' })).toBeVisible();

    await page.getByText('Starken', { exact: true }).click();
    for (const id of ['fullName', 'street', 'number', 'apartment', 'commune', 'region', 'phone']) {
      await page.fill(`#${id}`, '');
    }
    await page.getByRole('button', { name: /^Pagar \$/ }).click();
    await expect(page.getByText('Requerido para despacho a domicilio').first()).toBeVisible();
    await expect(page.getByText('Elige un método de pago')).toBeVisible();

    await page.fill('#fullName', 'Cliente Prueba');
    await page.fill('#street', 'Avenida Siempre Viva');
    await page.fill('#number', '742');
    await page.fill('#commune', 'Providencia');
    await page.fill('#region', 'Metropolitana');
    await page.fill('#phone', '12345');
    await page.getByText('Webpay Plus', { exact: true }).click();
    await page.getByRole('button', { name: /^Pagar \$/ }).click();
    await expect(page.getByText('Teléfono chileno inválido')).toBeVisible();

    await page.fill('#phone', '+56912345678');
    await payWithWebpay(page);
  });
});
