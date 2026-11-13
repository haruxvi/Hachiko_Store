# 13. Pruebas

Hay **316 pruebas automatizadas** en tres niveles. Cada nivel demuestra algo que los otros no
pueden. Los comandos están en el README (sección "Calidad y pruebas") y la teoría en
[../teoria/07-calidad-y-pruebas.md](../teoria/07-calidad-y-pruebas.md).

| Nivel | Cuántas | Herramienta | Contra qué corre | Qué demuestra |
|---|---|---|---|---|
| Unitarias | 247 en 25 archivos | Vitest (`pnpm test`) | Nada externo. La mayoría es lógica pura; en 5 archivos la base se reemplaza por un *mock* | Que la lógica calcula y decide bien |
| Integración | 53 en 4 archivos | Vitest (`pnpm test:integration`) | **PostgreSQL real** y desechable | Concurrencia, transacciones e idempotencia, que un *mock* no puede simular |
| End-to-end | 16 en 4 archivos | Playwright (`pnpm test:e2e`) | La tienda completa en Docker, con un navegador Chromium real | Que una persona puede comprar, entrar al panel y que la seguridad del navegador está activa |

## Unitarias (`tests/unit/`)

| Área | Archivos |
|---|---|
| Dinero y pedidos | `order-totals` (subtotal, envío gratis sobre el umbral, retiro sin costo), `inventory`, `panel-list` |
| Seguridad | `password-policy`, `totp`, `pii` (cifrado y descifrado, detección de alteraciones), `integrity-chain` (cadena de hash), `rbac`, `action-tokens`, `http-body` (tope de tamaño), `upload-guard` (bombas zip, macros, XXE), `deepmerge-patch`, `session-cookies` (access Lax, refresh Strict) |
| Catálogo | `catalog-admin`, `product-import`, `product-csv`, `product-xlsx`, `product-image` (firma real de las imágenes), `image-url` |
| API y PWA | `api-dto` (qué campos salen hacia afuera), `pwa` (qué guarda y qué no guarda el service worker) |
| Otros | `newsletter`, `store-time` (hora de Chile, también "hoy / ayer" con el servidor en UTC), `forecast-period`, `elasticity` |

## Integración (`tests/integration/`)

[setup.ts](../../tests/integration/setup.ts) **aborta si la base no es local**
(`127.0.0.1`, `localhost` o `::1`), así que estas pruebas nunca pueden tocar Neon. Los archivos
corren en serie (`fileParallelism: false`) porque comparten la base.

| Archivo | Algunas de las cosas que prueba |
|---|---|
| [checkout-flow.test.ts](../../tests/integration/checkout-flow.test.ts) | Cinco compras simultáneas de la última unidad: una sola reserva. Cinco pagos simultáneos con stock 2: nunca negativo. Webhook repetido: no descuenta dos veces. Monto distinto o sin monto: no se confirma. Cancelar y pagar al mismo tiempo: nunca "pagado y cancelado". Eliminación de cuenta a los 30 días |
| [refunds.test.ts](../../tests/integration/refunds.test.ts) | Cola de reembolsos, reembolso por Webpay y por Mercado Pago, monto realmente cobrado, rechazo de la pasarela, doble clic |
| [pickup-returns.test.ts](../../tests/integration/pickup-returns.test.ts) | Recordatorios de retiro a los 3 y 10 días, "no retirado" al vencer el plazo, retracto de 10 días y garantía de 6 meses, flujo completo de devolución y de cambio |
| [security-dispatch-analytics.test.ts](../../tests/integration/security-dispatch-analytics.test.ts) | Rotación de refresh tokens con detección de reutilización, bloqueo por intentos en paralelo, 2FA de un solo uso, estados del despacho, checkouts abandonados |

## End-to-end (`tests/e2e/`)

[playwright.config.ts](../../playwright.config.ts) **se niega a correr contra un host que no
sea local**, salvo con `E2E_ALLOW_REMOTE=1`, porque las pruebas crean pedidos. Corre con un solo
*worker*, porque las cuentas del seed y el límite de intentos por IP son compartidos.

| Archivo | Qué recorre |
|---|---|
| [storefront.spec.ts](../../tests/e2e/storefront.spec.ts) | Inicio, catálogo y ficha sin errores de consola; carrito vacío y con productos; aviso de cookies con dos opciones del mismo estilo; páginas legales y 404. **Corre en escritorio y en un Pixel 7 emulado** |
| [checkout.spec.ts](../../tests/e2e/checkout.spec.ts) | Compra como invitado con retiro en tienda; compra con cuenta que exige dirección y valida el teléfono. La llamada a Webpay se intercepta y se comprueba que el pedido ya existe (con `E2E_PAYMENTS=1` llega al formulario de integración de Transbank) |
| [panel.spec.ts](../../tests/e2e/panel.spec.ts) | Panel sin sesión → login; contraseña incorrecta con la misma respuesta que un correo inexistente; un cliente no entra al panel ni a la API del vendedor; el vendedor ve Demanda y el historial de precios; cabeceras de seguridad |
| [cuenta.spec.ts](../../tests/e2e/cuenta.spec.ts) | Derecho de supresión (Ley 21.719): un cliente pide eliminar su cuenta desde *Mis datos*, la solicitud se registra y la sesión se cierra |

Errores reales que encontraron estas pruebas y los recorridos completos, todos ya corregidos:

- **Despacho a domicilio:** la dirección faltante aparecía recién en el segundo intento. Se
  corrigió en `CheckoutForm.tsx`.
- **Vuelta desde Webpay o Mercado Pago:** la confirmación no veía la sesión (cookie `Strict`).
  Se encontró con una compra real en el ambiente de integración y se corrigió en `session.ts`.
- **Solicitar eliminación de cuenta:** el botón era un enlace GET a una ruta que solo acepta
  `DELETE`, así que respondía 405. Ahora es `DeleteAccountButton.tsx`, cubierto por `cuenta.spec.ts`.

Y al recorrer y fotografiar cada proceso a mano (web y app):

- **Stock fuera del libro:** editar la ficha de un producto podía cambiar su stock sin movimiento,
  y el alta no registraba la carga inicial. Cubierto en `catalog-admin`.
- **Carga masiva:** una comilla mal puesta se informaba como "Fila 1" y los errores de datos
  salían en inglés. Cubierto en `product-csv`.
- **Hora del servidor:** varias fechas del panel salían en UTC (un pedido de las 22:30 aparecía
  como "hoy 01:30" del día siguiente). Cubierto en `store-time`.
- **Bitácora de incidencias:** el cambio de estado quedaba como "OPEN → CONTAINED".
- **App:** el nombre "Ramen y fideos instantáneos" se cortaba en su tarjeta, y una foto que no
  cargaba dejaba un cuadro en blanco.

## Regla de regresión

Todo error corregido en lógica de negocio deja una prueba que lo habría detectado. Por ejemplo,
con zod 4, editar solo el precio de un producto borraba sus fotos: los valores por defecto del
esquema se aplicaban también en una edición parcial. Quedó cubierto en `catalog-admin` con la
prueba "editar solo el precio no toca fotos, visibilidad, destacado ni umbral".
