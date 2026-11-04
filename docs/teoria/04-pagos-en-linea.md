# 4. Pagos en línea

Cómo está implementado: [../codigo/04-pagos-y-reembolsos.md](../codigo/04-pagos-y-reembolsos.md).

## Por qué la tienda nunca toca la tarjeta

Hachiko usa **pasarelas con redirección**: el cliente escribe los datos de su tarjeta en el
formulario de Transbank o de Mercado Pago, no en el de Hachiko. Así:

- Hachiko **nunca recibe, transmite ni guarda datos de tarjeta**. El estándar de la industria
  de tarjetas (PCI DSS) se cumple con el nivel más simple de obligaciones, porque el riesgo
  queda en la pasarela, que está certificada.
- El banco aplica su propia autenticación del titular (3-D Secure) sin que la tienda intervenga.
- La CSP lo refleja: `form-action` solo permite enviar formularios al propio sitio y a Transbank.

## El canal del navegador no es confiable

En una redirección, el navegador del cliente transporta la información de ida y vuelta, y el
cliente **puede modificar** cualquier parámetro de la URL o del formulario. Por eso:

- **El resultado del pago se le pregunta a la pasarela, servidor a servidor.** En Webpay, la
  llamada `commit` devuelve el pedido (`buy_order`), el monto y el código de respuesta. En
  Mercado Pago, se consulta el pago por su id.
- **El monto cobrado se compara con el total del pedido guardado en la base.** Si no coincide,
  no se confirma: el pedido queda para reembolso.
- **El pedido sale de la respuesta de la pasarela**, no de la URL. Si saliera de la URL, alguien
  podría marcar como pagado (o como fallido) el pedido de otra persona.

## Dos formas de enterarse del pago

| Mecanismo | Cómo funciona | Riesgo que cubre |
|---|---|---|
| **Retorno del cliente** (Webpay `commit`) | El cliente vuelve al sitio con un token y el servidor confirma con Transbank | Es el camino normal |
| **Webhook** (Mercado Pago) | La pasarela llama directamente al servidor | El cliente cierra el navegador antes de volver |

Un webhook es una llamada desde Internet a un endpoint público, así que **cualquiera podría
llamarlo**. Por eso se verifica una **firma HMAC**: Mercado Pago firma un manifiesto (id del
pago, id de la petición, marca de tiempo) con un secreto que solo conocen la pasarela y la
tienda. Sin el secreto, no se puede fabricar una firma válida.

## Entrega "al menos una vez"

Las pasarelas reintentan los webhooks hasta recibir una respuesta exitosa. Por eso el receptor
debe ser **idempotente**: procesar el mismo aviso dos veces no puede descontar dos veces el
stock ni duplicar un correo. Ver
[02-concurrencia-y-transacciones.md](02-concurrencia-y-transacciones.md).

Además, la confirmación devuelve éxito incluso cuando el pedido no existe (lo audita). Si
devolviera error, la pasarela reintentaría sin fin un aviso que nunca va a funcionar.

## Estados del pago y conciliación

La tienda separa el **estado del pedido** (pendiente, pagado, enviado…) del **estado del pago**
(impago, pagado, fallido, reembolso pendiente, reembolsado). Así se pueden representar casos
reales que no son "felices":

- Llegó dinero de un pedido que el cliente ya canceló.
- El monto cobrado no coincide con el total.
- Se pagó, pero en ese segundo se vendió la última unidad.

En todos esos casos el dinero entró y **la tienda no debe quedárselo**. El pedido pasa a
`REFUND_PENDING` y aparece como alerta crítica hasta que el vendedor reembolsa. Esa cola es la
**conciliación**: cada peso cobrado termina en una venta o en un reembolso.

## Ambientes de integración y producción

Transbank y Mercado Pago ofrecen un **ambiente de integración**: llaves y tarjetas de prueba que
no mueven dinero real. Hachiko corre ahí. Pasar a producción exige:

1. que el comercio firme con la pasarela;
2. que apruebe su proceso de validación;
3. cargar las llaves productivas (`TBK_ENV=production`).

El código no cambia.
