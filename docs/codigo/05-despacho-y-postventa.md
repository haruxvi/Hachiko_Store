# 5. Despacho y postventa

Archivos centrales: [order.service.ts](../../src/lib/services/order.service.ts),
[pickup.service.ts](../../src/lib/services/pickup.service.ts),
[returns.service.ts](../../src/lib/services/returns.service.ts),
[shipping.ts](../../src/lib/shipping.ts).

## Estados del pedido

```
            pago confirmado         "lo estoy empacando"      despachado / listo para retiro
PENDING ───────────────────► PAID ─────────────────► PREPARING ─────────────────► SHIPPED ──► DELIVERED
   │                           └──────────── (se puede despachar directo) ─────────►│
   └──► CANCELLED  (cancelado por el cliente antes de pagar, pago inaplicable o retiro no buscado)
```

El estado del pago va aparte (`PaymentStatus`): `UNPAID`, `PAID`, `FAILED`, `REFUND_PENDING` y
`REFUNDED`.

**Cada transición es un `UPDATE` condicional.** Por ejemplo, `SHIPPED` se aplica solo
`WHERE paymentStatus = PAID AND status IN (PAID, PREPARING)`. Por eso:

- No se puede entregar algo que no se envió, ni preparar algo ya enviado.
- Un doble clic en "entregado" se registra una sola vez.
- Cada cambio deja una fila en `OrderStatusHistory`, con estado anterior, estado nuevo, quién lo
  hizo y una nota. Con eso se arma la línea de tiempo que ven el cliente y el vendedor.

Pruebas: "Flujo de despacho" en
[security-dispatch-analytics.test.ts](../../tests/integration/security-dispatch-analytics.test.ts).

## Despacho y seguimiento

- El vendedor despacha desde la trastienda o la app (`/api/v1/seller/orders/[id]/ship`) y puede
  escribir el **número de seguimiento** del courier.
- `trackingUrlFor` ([shipping.ts](../../src/lib/shipping.ts)) arma el enlace a la página
  pública de seguimiento de Starken o de Correos de Chile. El cliente lo recibe por correo y lo
  ve en *Mis pedidos*.
- **No hay integración automática con las APIs de los couriers.** Las APIs de Starken, Correos
  de Chile y Blue Express son de pago, exigen contrato y no ofrecen un ambiente gratuito de
  desarrollo. Está documentado como fuera de alcance en el README. El día que exista el
  contrato, el cambio se concentra en `shipping.ts` y en el paso de despacho.

## Retiro en tienda no buscado ([pickup.service.ts](../../src/lib/services/pickup.service.ts))

Para un pedido con retiro, "despachado" significa **listo para retirar**. Desde ese momento:

- Corre un plazo de **15 días corridos** (`PICKUP_DEADLINE_DAYS`).
- El cron diario envía **recordatorios a los 3 y 10 días** (`PICKUP_REMINDER_DAYS`), sin
  repetirlos.
- Vencido el plazo, el vendedor puede marcar el pedido como **"no retirado"** (no antes, ni en
  un pedido con despacho a domicilio). Eso hace tres cosas:
  1. Cancela el pedido.
  2. **Devuelve el stock** (movimiento de inventario).
  3. Deja el pago en la cola de reembolsos con motivo `NOT_PICKED_UP`.

La alerta "pedido de retiro en tienda venció sin que lo fueran a buscar" de Métricas sale de
`countOverduePickups`.

## Cambios y devoluciones (Ley 19.496)

El cliente las pide desde `/pedidos/[id]/devolucion` y el vendedor las gestiona en
`/trastienda/devoluciones`. Los plazos corren **desde la entrega** (o desde el despacho, en
pedidos antiguos sin fecha de entrega):

| Tipo | Plazo | El cliente puede pedir |
|---|---|---|
| **Retracto** | 10 días (`RETRACTO_DAYS`) | Cambio o devolución del dinero |
| **Garantía legal** | 6 meses (`GARANTIA_MONTHS`) | Cambio, reparación o devolución del dinero |

### Flujo

```
REQUESTED ──► APPROVED ──► RECEIVED ──► RESOLVED
     └──────► REJECTED (exige motivo; no se permite si el producto ya volvió al stock)
```

1. **Solicitud:** solo para pedidos entregados y propios. No se pueden pedir más unidades de las
   compradas, ni abrir una segunda solicitud mientras haya otra en curso para el mismo pedido.
2. **Aprobación:** el vendedor acepta, y el cliente entrega el producto.
3. **Recepción:** el vendedor decide si el producto **vuelve al stock**, lo que genera un
   movimiento `RETURNED`.
4. **Resolución:**
   - **Cambio:** entrega una unidad nueva, que descuenta stock (movimiento `EXCHANGE`). Sin
     stock no se puede.
   - **Devolución del dinero:** devuelve **solo el valor de los productos devueltos**, por la
     pasarela o registrada como manual. Si la pasarela rechaza, la solicitud vuelve a "recibido"
     y queda auditado. Un doble clic no llama dos veces a la pasarela.
   - **Reparación:** se registra.

Pruebas: "Cambios y devoluciones (Ley 19.496)" y "Retiro en tienda no buscado" en
[pickup-returns.test.ts](../../tests/integration/pickup-returns.test.ts).
