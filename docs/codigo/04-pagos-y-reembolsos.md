# 4. Pagos y reembolsos

Archivos centrales: [payment.service.ts](../../src/lib/services/payment.service.ts),
[webpay.ts](../../src/lib/payments/webpay.ts),
[mercadopago.ts](../../src/lib/payments/mercadopago.ts) y las rutas de
`src/app/api/payments/`.

## La idea que guía todo

**El servidor nunca cree lo que dice el navegador sobre un pago.** El monto, el pedido y si
fue aprobado se le preguntan siempre a la pasarela, servidor a servidor. El navegador solo
transporta al cliente de ida y vuelta.

## Webpay Plus (Transbank)

```
Cliente          Hachiko                              Transbank
  │ Pagar ───────►│ POST /api/payments/webpay/create
  │               │  ├─ el pedido es del usuario y está impago
  │               │  └─ create(orderId, session_orderId, totalCLP, returnUrl) ─►│
  │◄── url+token ─│◄─────────────────────────────────────────────── url, token ─│
  │ formulario POST token_ws ───────────────────────────────────────────────────►│
  │                       (el cliente paga en el formulario de Transbank)         │
  │◄────────────────────────────────── redirección a /api/payments/webpay/commit ─│
  │               │ commit(token) ─────────────────────────────────────────────►│
  │               │◄──────────────── buy_order, amount, response_code ──────────│
  │               │ confirmPaymentAndMarkPaid(buy_order, amount)
  │◄── 303 /checkout/success (o /checkout/failure)
```

- **create** ([create/route.ts](../../src/app/api/payments/webpay/create/route.ts)): exige
  sesión y que el pedido sea del usuario y esté impago (`getUnpaidOrderForUser`). El monto es
  `order.totalCLP`, sacado de la base.
- **commit** ([commit/route.ts](../../src/app/api/payments/webpay/commit/route.ts)):
  - Acepta la vuelta por GET o POST, porque Transbank usa ambos.
  - El pedido sale de `buy_order` **en la respuesta de Transbank**, no de un parámetro de la
    URL.
  - Se considera autorizado solo si `response_code === 0`.
  - Si el cliente abandona (llega `TBK_TOKEN`), el pedido a marcar como fallido también se le
    pregunta a Transbank. El parámetro `TBK_ORDEN_COMPRA` de la URL lo podría escribir
    cualquiera.
  - Responde con 303 para que el navegador siga con GET después del POST de Transbank.
- El ambiente lo decide `TBK_ENV`: `integration` (por defecto) o `production`. Pasar a
  producción es cambiar esa variable y cargar las llaves del comercio. No requiere cambios de
  código.

## Mercado Pago

- **Preferencia** (`/api/payments/mp/preference`): se crea con los ítems del pedido y
  `external_reference = orderId`, y el navegador va a `initPoint`.
- **Webhook** ([mp/webhook/route.ts](../../src/app/api/payments/mp/webhook/route.ts)):
  1. Verifica la **firma HMAC-SHA256** del header `x-signature` sobre el manifiesto
     `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, con comparación en tiempo constante
     (`verifyMpWebhookSignature`).
  2. Rechaza si el `data.id` del cuerpo no coincide con el del query string, porque solo este
     último está firmado.
  3. **Idempotencia:** si el `x-request-id` ya está en `ProcessedWebhook`, responde OK sin
     procesar de nuevo.
  4. Consulta el pago a Mercado Pago (`getMpPayment`) y usa **su** monto y su estado.
  5. `approved` confirma el pedido; `rejected` o `cancelled` lo marca como fallido.

## La confirmación atómica (`confirmPaymentAndMarkPaid`)

Corre en una transacción Serializable con reintentos. Devuelve uno de cuatro resultados:

| Resultado | Cuándo | Qué hace |
|---|---|---|
| `already_paid` | El pedido ya está `PAID`, `REFUND_PENDING` o `REFUNDED` | Nada (idempotencia: un commit o webhook repetido no descuenta dos veces) |
| `refund_pending` | El pedido ya no está pendiente (por ejemplo, el cliente lo canceló) | Pedido → `CANCELLED` + `REFUND_PENDING`, motivo `ORDER_CANCELLED` |
| `refund_pending` | Monto indefinido, ≤ 0 o distinto al total | Igual, motivo `AMOUNT_MISMATCH` (**fail-closed**: un monto anómalo no se confirma a ciegas) |
| `refund_pending` | No queda stock al confirmar | Igual, motivo `OUT_OF_STOCK`; no se descuenta nada |
| `paid` | Todo cuadra | Descuenta el stock físico (`deductStockForOrder`), registra el movimiento `OUT/SALE`, borra la reserva, marca `PAID`, registra `PAYMENT_CONFIRMED` |
| `not_found` | La referencia no corresponde a ningún pedido | Lo audita y responde sin error, para que la pasarela no reintente sin fin |

Detalles que importan:

- **El estado `FAILED` también se puede pagar**, porque Mercado Pago permite reintentar con otra
  tarjeta en la misma preferencia: un "rechazado" puede ir seguido de un "aprobado".
- **Un pago tardío también funciona.** Si la reserva de 15 minutos venció, el pago igual se
  concreta mientras haya unidades que **no estén reservadas por otros** pedidos vigentes. Si ya
  no hay, queda para reembolso y el stock nunca queda negativo.
- `deductStockForOrder` **valida todas las líneas antes de escribir**: no existe el descuento
  parcial.
- El correo de confirmación y la purga de la caché del catálogo ocurren **fuera** de la
  transacción. Si el correo falla, el pago no se revierte.

## Reembolsos

Cuando entra dinero que la tienda no debe quedarse, el pedido queda en `REFUND_PENDING` y
aparece en la **cola de reembolsos** de la trastienda (`getRefundQueue`), con su motivo,
pasarela y monto. Hay cuatro motivos: pedido cancelado, monto distinto, sin stock y retiro no
buscado.

`refundOrder`:

1. **Reclama el pedido primero** con un `UPDATE` condicional `REFUND_PENDING → REFUNDED`. Un
   doble clic o dos vendedores a la vez no pueden devolver dos veces: la pasarela se llama una
   sola vez.
2. Devuelve **lo que realmente se cobró**. Si el motivo fue un monto distinto, se devuelve el
   monto cobrado, no el total del pedido (`chargedAmount`).
3. Tiene dos modos:
   - `provider`: llama a la pasarela. En Webpay es `refund(token, amount)`. En Mercado Pago es
     el reembolso total con **idempotency key** `refund-<orderId>`.
   - `manual`: la tienda devolvió el dinero por otro medio y solo lo registra.
4. Si la pasarela rechaza, el pedido vuelve a `REFUND_PENDING` y queda `REFUND_FAILED` en la
   bitácora.
5. Avisa al cliente por correo.

Pruebas: [refunds.test.ts](../../tests/integration/refunds.test.ts) y la sección "Confirmación de
pago atómica" de [checkout-flow.test.ts](../../tests/integration/checkout-flow.test.ts).

## Si falla lo nuestro después de que Transbank autorizó

Si Transbank autorizó pero falla la base de datos al confirmar, el cliente ve la página de
fallo y el error queda en el log con el token de Transbank, para conciliar a mano. La reserva de
stock vence sola. Este es el único caso que requiere intervención humana, y está registrado.
