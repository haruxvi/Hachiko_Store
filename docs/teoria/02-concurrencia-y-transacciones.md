# 2. Concurrencia, transacciones e idempotencia

El problema de fondo de toda tienda es que **dos cosas ocurren al mismo tiempo sobre el mismo
dato**: dos personas compran la última unidad, un pago llega mientras el cliente cancela, o la
pasarela avisa dos veces del mismo pago. Este documento explica la teoría que lo resuelve. La
implementación está en [../codigo/03-compra.md](../codigo/03-compra.md) y
[../codigo/04-pagos-y-reembolsos.md](../codigo/04-pagos-y-reembolsos.md).

## Transacciones ACID

Una transacción agrupa varias operaciones que deben ocurrir **todas o ninguna**:

- **Atomicidad:** si algo falla, no queda nada a medias. Por ejemplo, no puede existir un
  pedido pagado con el stock sin descontar.
- **Consistencia:** se respetan las restricciones de la base (claves únicas, foráneas).
- **Aislamiento:** las transacciones simultáneas no se ven a medio hacer (ver abajo).
- **Durabilidad:** una vez confirmada, sobrevive a una caída.

## Niveles de aislamiento y anomalías

El estándar SQL define niveles de aislamiento según qué anomalías permiten:

| Nivel | Lectura sucia | Lectura no repetible | Fantasma | Anomalía de serialización (*write skew*) |
|---|---|---|---|---|
| Read Committed (el valor por defecto de PostgreSQL) | No | Sí | Sí | Sí |
| Repeatable Read | No | No | No en PostgreSQL | Sí |
| **Serializable** | No | No | No | **No** |

**El caso de la última unidad es un *write skew*.** Dos transacciones leen "queda 1 disponible",
y cada una inserta su propia reserva: no escriben la misma fila, así que ningún bloqueo de fila
las frena. Con Read Committed ambas terminan bien y se vende dos veces.

**Serializable garantiza que el resultado equivale a ejecutarlas una después de la otra.**
PostgreSQL lo implementa con *Serializable Snapshot Isolation* (SSI): no bloquea las lecturas,
sino que registra qué leyó cada transacción. Si detecta una dependencia peligrosa entre ellas,
**aborta una** con el error `40001` (*serialization failure*).

## Reintento con espera exponencial y aleatoria

Una transacción abortada por serialización **no es un error del negocio**: es una señal de
"inténtalo de nuevo". `withSerializableRetry` la repite hasta 8 veces. Entre intentos espera
`min(1 s, 20 ms × 2^intento)`, multiplicado por un factor aleatorio entre 0,5 y 1,5:

- Lo **exponencial** reduce la presión si el conflicto persiste.
- Lo **aleatorio** (*jitter*) evita que dos reintentos vuelvan a chocar sincronizados.

En el reintento, la transacción ya ve la reserva de la otra y responde con honestidad: "Stock
insuficiente".

**Alternativa: bloqueo pesimista** (`SELECT … FOR UPDATE`). También funciona, pero bloquea filas
y hay que acordarse de hacerlo en cada consulta. Serializable protege toda la transacción sin
que el programador tenga que adivinar qué bloquear.

## Reservas con vencimiento (bloqueo suave con TTL)

Descontar el stock al crear el pedido sería injusto, porque muchos pedidos nunca se pagan. No
reservar nada permitiría que el cliente pague algo que otro ya compró. La solución intermedia:

- El pedido **reserva** las unidades por 15 minutos.
- El "disponible" es el stock menos las reservas **vigentes**. El vencimiento se aplica al leer
  (`expiresAt > now()`), así que no depende de que un proceso las borre.
- El stock físico solo baja cuando el pago se confirma.

Es un **bloqueo suave con tiempo de vida (TTL)**: si el dueño desaparece, el bloqueo se libera
solo.

## Operaciones condicionales (*compare-and-set*)

Varios cambios de estado se escriben como `UPDATE … WHERE estado = esperado` y se revisa
cuántas filas cambiaron:

- Cancelar solo si `status = PENDING` y no está pagado.
- Despachar solo si está pagado y en `PAID` o `PREPARING`.
- Reclamar un reembolso solo si está `REFUND_PENDING`.
- Consumir un refresh token solo si `usedAt IS NULL`.

Si cambiaron 0 filas, alguien se adelantó. Es la versión en SQL de la instrucción atómica
*compare-and-set*, y es lo que hace que un **doble clic** o dos vendedores a la vez no repitan
una acción.

## Idempotencia

Una operación es **idempotente** si ejecutarla varias veces deja el mismo resultado que
ejecutarla una.

**Por qué importa:** las pasarelas y las redes entregan los avisos **"al menos una vez"**. Si
Hachiko demora en responder, Mercado Pago reintenta el webhook, y el navegador puede volver a
enviar el retorno de Webpay.

**Cómo se logra:**

| Mecanismo | Dónde |
|---|---|
| Revisar el estado antes de actuar | `confirmPaymentAndMarkPaid` no hace nada si el pedido ya está pagado o en reembolso |
| Registrar los avisos procesados | `ProcessedWebhook` guarda el `x-request-id` de cada webhook de Mercado Pago |
| Clave de idempotencia hacia la pasarela | El reembolso a Mercado Pago lleva `refund-<idPedido>`: si se repite, Mercado Pago no devuelve dos veces |
| Operaciones condicionales | Ver la sección anterior |

## Efectos fuera de la transacción

Enviar un correo o purgar una caché **no se puede deshacer** con un `ROLLBACK`. Por eso esas
acciones van **después** de confirmar la transacción, y su falla no revierte el negocio:
`sendEmail` nunca lanza error. El orden es este: primero lo que debe ser consistente, después
los efectos secundarios.

## Cómo se demuestra

Nada de esto se puede probar con *mocks*, porque la concurrencia vive en la base. Por eso
existen las pruebas de integración contra un PostgreSQL real
([checkout-flow.test.ts](../../tests/integration/checkout-flow.test.ts)), que lanzan operaciones
simultáneas con `Promise.all` y verifican el resultado:

- cinco compras de la última unidad terminan en una sola reserva;
- cinco pagos con stock 2 nunca dejan el stock negativo;
- cancelar y pagar al mismo tiempo nunca deja un pedido "pagado y cancelado".
