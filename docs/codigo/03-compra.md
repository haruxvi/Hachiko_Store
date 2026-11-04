# 3. Del carrito al pedido

Archivos centrales: [catalog.service.ts](../../src/lib/services/catalog.service.ts),
[stores/cart.ts](../../src/lib/stores/cart.ts),
[CheckoutForm.tsx](../../src/components/storefront/CheckoutForm.tsx),
[actions/cart.ts](../../src/actions/cart.ts),
[order.service.ts](../../src/lib/services/order.service.ts),
[inventory.service.ts](../../src/lib/services/inventory.service.ts),
[shipping.ts](../../src/lib/shipping.ts).

## 1. Catálogo

- Las páginas `/catalogo` y `/producto/[slug]` son Server Components que leen con
  `getProducts` y `getProductBySlug`. Solo muestran productos `active = true` y sin
  `archivedAt`.
- **El stock que ve el cliente es el disponible:** stock físico menos las reservas vigentes de
  otros pedidos (`getAvailableStock` / `getAvailableStockBatch`).
- La API pública no entrega el stock exacto, solo un estado: `ok`, `low` (y cuántas quedan) u
  `out`. La regla está en `stockInfo` de [dto.ts](../../src/lib/api/dto.ts). Así un competidor
  no puede medir las ventas leyendo el stock.

## 2. Carrito

- Vive **en el navegador** (zustand con `persist` en `localStorage`, clave `hachiko-cart`).
  Por eso funciona sin cuenta y sobrevive al cerrar la pestaña.
- El carrito guarda el precio solo **para mostrarlo**. Al pagar, el servidor vuelve a leer el
  precio desde la base: un carrito editado a mano no puede cambiar lo que se cobra.
- [CartClient.tsx](../../src/components/storefront/CartClient.tsx) espera a que el componente
  se monte antes de pintar el contenido. Así el HTML del servidor (que no conoce el
  `localStorage`) no choca con el del navegador.

## 3. Checkout

- [checkout/page.tsx](../../src/app/%28checkout%29/checkout/page.tsx):
  - **Sin sesión**, muestra la puerta de "iniciar sesión, crear cuenta o continuar como
    invitado".
  - **Con sesión**, precarga la última dirección usada.
- El formulario usa react-hook-form con zod. La calle, el número, la comuna y la región son
  obligatorios **solo con despacho a domicilio**. Para retiro en tienda bastan nombre y teléfono.
- El teléfono se valida con formato chileno (`+56 9 XXXX XXXX`), en `ShippingAddressSchema` de
  [schemas.ts](../../src/lib/validation/schemas.ts).
- **El servidor valida lo mismo de nuevo** (`CheckoutSchema`). La validación del navegador es
  solo comodidad.

### Costo de envío ([shipping.ts](../../src/lib/shipping.ts))

| Método | Costo |
|---|---|
| Retiro en tienda (Recoleta) | $0 |
| Starken o Correos de Chile | $3.990, gratis desde $50.000 de subtotal |

Ese archivo es la **única fuente de verdad** de los métodos de entrega. La etiqueta, la
descripción, si pide dirección y el enlace de seguimiento salen de ahí para el checkout, los
correos, *Mis pedidos* y la trastienda.

## 4. Creación del pedido (`checkoutAction` → `createOrder`)

`checkoutAction` exige sesión, aplica límites de frecuencia (12 pedidos cada 5 minutos por
usuario y 20 por IP) y valida con zod. Luego `createOrder` hace todo en **una transacción
Serializable** (`withSerializableRetry`):

1. Lee los productos pedidos y verifica que sigan activos.
2. Suma las **reservas vigentes** de esos productos (`activeReservations`).
3. Por cada línea: disponible = stock − reservado. Si no alcanza, falla con "Stock
   insuficiente".
4. Calcula el subtotal **con el precio de la base**, el envío y el total.
5. Crea el `Order` con sus `OrderItem`. Cada línea guarda una copia del nombre y del precio
   unitario de ese momento, para que el pedido no cambie si después cambia el producto.
6. Cifra con AES-256-GCM el nombre, el teléfono, la calle, el número y el departamento del
   destinatario. La comuna y la región quedan en claro porque se usan en analítica de
   logística.
7. Crea una `StockReservation` por línea, que **vence en 15 minutos**
   (`RESERVATION_TTL_MINUTES`).
8. Registra el primer estado `PENDING` en `OrderStatusHistory` y, ya fuera de la transacción,
   `ORDER_CREATED` en la bitácora.

### Por qué no hay sobreventa

Si dos personas compran la última unidad al mismo tiempo, PostgreSQL detecta el conflicto entre
las dos transacciones Serializable y **aborta una**. `withSerializableRetry` la reintenta (hasta
8 veces, con espera exponencial y aleatoria). En el reintento ve la reserva de la otra persona
y responde "Stock insuficiente". La prueba de integración lanza **5 compras simultáneas de la
última unidad** y exige que exista exactamente una reserva
([checkout-flow.test.ts](../../tests/integration/checkout-flow.test.ts)). La teoría está en
[../teoria/02-concurrencia-y-transacciones.md](../teoria/02-concurrencia-y-transacciones.md).

### Qué pasa con las reservas vencidas

Una reserva vencida **deja de contar en ese mismo instante**, porque toda consulta filtra
`expiresAt > now()`. El cron diario `clean-reservations` solo borra las filas viejas; la
corrección no depende de él.

## 5. Cancelar antes de pagar

`cancelOrder` cambia el estado con un `UPDATE` condicional: solo pasa a `CANCELLED` si el
pedido es del usuario, está `PENDING` y no está pagado. Si el pago se confirma en el mismo
instante, solo una de las dos operaciones gana: nunca queda "pagado y cancelado". Un pago que
llegue **después** de cancelar no revive el pedido, sino que lo deja para reembolso (ver
[04-pagos-y-reembolsos.md](04-pagos-y-reembolsos.md)).

## 6. El puente app → pago web

La app no implementa pagos. En el carrito de la app, el botón de pagar abre en el navegador
seguro del teléfono (`WebBrowser.openAuthSessionAsync`)
`/carrito/desde-app?i=slug:cantidad,…`.

Esa página ([desde-app/page.tsx](../../src/app/%28storefront%29/carrito/desde-app/page.tsx)) hace
lo siguiente:

- Valida el formato: como máximo 30 líneas y cantidades de 1 a 99.
- **El servidor pone el precio y revisa el stock**, y ajusta las cantidades si algo se agotó,
  avisando qué cambió.
- Arma el carrito web y sigue al checkout normal.

Así hay un solo flujo de pago para todos.

## 7. Medición del embudo (solo con consentimiento)

Lo que se mide: vista de producto, búsqueda, agregar al carrito y abrir el checkout.

- `track()` ([analytics/client.ts](../../src/lib/analytics/client.ts)) **no envía nada si la
  persona no eligió "Aceptar medición"** en el aviso de cookies.
- Aun con medición aceptada, el evento se asocia a la cuenta solo si el usuario dio
  consentimiento comercial y el navegador no envía la señal Global Privacy Control
  (`Sec-GPC: 1`). En cualquier otro caso queda anónimo.

Estos eventos alimentan la vista **Conversión** de la trastienda.
