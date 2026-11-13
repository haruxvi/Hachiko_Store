# Preguntas probables de la comisión

Cada respuesta tiene tres partes: **la respuesta corta**, **el concepto** que la respalda y
**dónde mostrarlo**. Todo está verificado contra el código al 4 de noviembre de 2026.

---

## Arquitectura

**¿Por qué un solo backend para web, PWA y app?**
Para que cada regla de negocio exista una sola vez. La app usa la misma base y los mismos
servicios por la API v1. *Concepto:* monolito modular por capas (entrada → servicio → datos);
evita que dos implementaciones de la misma regla diverjan. *Mostrar:*
[01-panorama.md](../codigo/01-panorama.md), `src/lib/services/`.

**¿Por qué el ML corre en Python en GitHub Actions y no en Vercel?**
Vercel es serverless: tiene tiempos máximos por petición y no está pensado para librerías
científicas pesadas. Los modelos se entrenan por lotes, una vez al día, y dejan sus resultados
en tablas que la trastienda solo lee. *Concepto:* separar el plano operacional (OLTP) del
analítico, con inferencia por lotes; ninguna predicción se calcula en vivo. *Mostrar:*
`.github/workflows/ml-train.yml`, [machine-learning.md](../machine-learning.md).

**¿El pipeline de ML puede dañar los datos de la tienda?**
No. Solo lee las tablas operacionales y escribe en siete tablas derivadas (`ModelRun`,
`KpiSnapshot`, `DemandForecast`, `RestockSuggestion`, `ProductRecommendation`,
`CustomerSegment` y `RiskScore`). Nunca cambia el esquema: Prisma es el único dueño del DDL.
*Mostrar:* el encabezado de `ml/ml/db.py`.

---

## Concurrencia y stock

**¿Qué pasa si dos personas compran la última unidad al mismo tiempo?**
Solo una la consigue. El pedido se crea en una transacción **Serializable**: PostgreSQL detecta
el conflicto, aborta una de las dos y el sistema la reintenta. En el reintento ya ve la reserva
de la otra persona y responde "Stock insuficiente". *Concepto:* nivel de aislamiento
Serializable (en PostgreSQL, *Serializable Snapshot Isolation*) más reintento con espera
exponencial y aleatoria (*jitter*). *Mostrar:* `withSerializableRetry` en
`src/lib/services/inventory.service.ts` y la prueba "cinco compras simultáneas de la última
unidad" en `tests/integration/checkout-flow.test.ts`.

**¿Por qué reservar stock 15 minutos en vez de descontarlo al crear el pedido?**
Porque muchos pedidos nunca se pagan. La reserva aparta las unidades mientras el cliente está
en Webpay, y si no paga, vencen solas: toda consulta filtra `expiresAt > now()`. El stock
físico solo baja cuando el pago se confirma. *Concepto:* bloqueo suave con expiración (TTL).
*Mostrar:* [03-compra.md](../codigo/03-compra.md).

**¿Y si alguien paga después de que venció la reserva?**
El pago se concreta si quedan unidades no reservadas por otros. Si no quedan, el pedido pasa a
reembolso y el stock nunca queda negativo. *Mostrar:* la prueba "pago tardío cuando la última
unidad ya se vendió".

**¿Cómo evitan cobrar o procesar dos veces?**
Con idempotencia. Si el pedido ya está pagado, una confirmación repetida no hace nada. Los
webhooks de Mercado Pago se registran en `ProcessedWebhook`, y el reembolso a Mercado Pago lleva
la clave `refund-<idPedido>`. Los cambios de estado son `UPDATE` condicionales: un doble clic
se registra una sola vez. *Concepto:* las pasarelas entregan los avisos "al menos una vez", así
que el receptor debe ser idempotente.

---

## Pagos

**¿Cómo saben que el pago es real y no un navegador que dice "pagué"?**
El servidor le pregunta a la pasarela, servidor a servidor. En Webpay, el pedido y el monto
salen de la respuesta de `commit` de Transbank. En Mercado Pago, se verifica la firma HMAC del
webhook y luego se consulta el pago. **Si el monto no coincide con el total, no se confirma**
(*fail-closed*). *Mostrar:* [04-pagos-y-reembolsos.md](../codigo/04-pagos-y-reembolsos.md).

**¿Por qué no están los pagos en producción?**
Es un trámite comercial, no de código. El comercio debe firmar con Transbank y pasar su
validación. El código ya está listo: basta `TBK_ENV=production` y las llaves productivas.

---

## Seguridad

**¿Cómo guardan las contraseñas?**
Con **argon2id** (64 MiB de memoria, 3 iteraciones). *Concepto:* es una función de hash lenta y
que exige mucha memoria a propósito: probar millones de contraseñas con tarjetas gráficas sale
carísimo. Fue la ganadora de la Password Hashing Competition y la recomienda OWASP.

**¿Se puede averiguar si un correo tiene cuenta?**
En el login, no: el mensaje es siempre "Credenciales inválidas", y si el correo no existe igual
se calcula un argon2 de relleno, para que el tiempo de respuesta no lo delate. En el registro
tampoco: la respuesta es igual y al dueño del correo le llega un aviso. *Una limitación
honesta:* "continuar como invitado" con un correo ya registrado pide iniciar sesión, lo que sí
revela que existe. Se aceptó porque entregar sesión solo con el correo sería peor, y ese camino
tiene un límite de 5 intentos por minuto por IP.

**¿Qué pasa si roban el refresh token?**
Cada renovación entrega uno nuevo y consume el anterior. Si un token ya usado reaparece pasados
30 segundos, alguien lo copió: se revoca toda esa sesión y queda en la bitácora. *Concepto:*
rotación de refresh tokens con detección de reutilización (RFC 6819 §5.2.2.3). *Limitación:* un
access token robado sigue sirviendo hasta que vence, porque no se consulta la base en cada
petición. Por eso dura solo 15 minutos.

**¿Por qué los tokens van cifrados y no solo firmados?**
Un JWT firmado se puede leer en base64: rol, correo e id. Uno cifrado (JWE con AES-256-GCM) es
opaco. En ambos casos no se puede falsificar un rol sin la clave del servidor.

**¿Cómo protegen los datos personales guardados?**
El nombre, el teléfono y la dirección de despacho, junto con el secreto del 2FA, se cifran con
**AES-256-GCM** antes de guardarse. *Concepto:* cifrado autenticado: además de ocultar el
contenido, detecta si alguien lo alteró. *Mostrar:* `src/lib/crypto/pii.ts`.

**¿Cómo frenan un XSS?**
Con una Content-Security-Policy con *nonce* por respuesta y `strict-dynamic`: solo se ejecutan
los scripts que el servidor firmó en esa respuesta. Para los scripts no hay `unsafe-inline`, y en
producción tampoco `unsafe-eval` (solo se habilita en desarrollo para la recarga en caliente).
Los estilos sí permiten `unsafe-inline`: un estilo inyectado no ejecuta código, y el riesgo de XSS
está en los scripts. Se suman `frame-ancestors 'none'` contra *clickjacking* y cookies `HttpOnly`
(un script inyectado no podría leer la sesión). *Mostrar:* `buildCsp` en `src/middleware.ts`.

**¿Por qué la cookie de sesión es `SameSite=Lax` y no `Strict`?**
Porque el comprador vuelve a la tienda desde el sitio de Transbank o de Mercado Pago, y el
navegador no envía cookies `Strict` en una navegación que viene de otro sitio. Con `Strict`, la
confirmación mostraba "No encontramos una orden pagada" aunque el pedido estaba pagado. El error
se detectó haciendo una compra real en el ambiente de integración de Webpay. `Lax` sí viaja en
esa navegación y sigue bloqueando el POST desde otro sitio, que es lo que importa contra CSRF.
El refresh token sigue `Strict`, porque solo lo usa `/api/auth`. *Mostrar:*
`src/lib/auth/session.ts` y `tests/unit/session-cookies.test.ts`.

**¿Qué garantiza la bitácora de incidencias?**
Que alterarla se nota. Cada evento guarda el hash SHA-256 del anterior. Si alguien modifica,
borra o reordena un evento, la cadena se rompe en ese punto y `verifyChain` lo señala.
*Concepto:* evidencia de manipulación (*tamper-evident*), la misma idea de un blockchain sin
consenso. No impide que un administrador de la base borre todo, pero sí que lo haga sin dejar
rastro. *Mostrar:* `src/lib/crypto/integrity.ts`.

**¿Por qué se suben archivos Excel si eso es riesgoso?**
Porque se revisan antes de abrirlos: se descomprimen con tope (contra bombas zip), se rechazan
macros, objetos incrustados y XML con entidades (XXE), y nunca se guardan ni se ejecutan.
*Mostrar:* `src/lib/upload-guard.ts`.

---

## Datos y modelos

**¿Por qué Métricas dice 2.318 órdenes y el modelo de fraude dice 4.739?**
Miden cosas distintas. Métricas cuenta **ventas válidas** (pagadas y no canceladas) de los
últimos 12 meses cerrados. El modelo de fraude se entrena con **todas las órdenes de la
historia**, incluidas las impagas y canceladas, porque necesita ver el comportamiento completo.
Después solo marca las recientes, pagadas y aún sin despachar. *Mostrar:*
`ml/jobs/fraud_detection.py` y `SALE_WHERE` en `src/lib/sales.ts`.

**¿Su forecast es bueno?**
Se evalúa honestamente. Se entrena sin los últimos 3 meses cerrados, se predicen esos meses y
se compara el error (MAE) con un modelo ingenuo: "lo mismo que el mismo mes del año pasado".
Ambos errores aparecen en **Modelos** (`mae_promedio` y `mae_ingenuo`). Si el modelo pierde
contra el ingenuo, se muestra igual; ajustarlo mirando esos meses sería *data leakage*: el modelo
quedaría bien en la prueba porque ya la vio. *Concepto:* validación temporal (*backtest*) contra
una línea base. Con datos de demostración es razonable que una regresión simple no le gane a la
estacionalidad pura.

**¿Qué es el modelo de forecast?**
Una regresión **Ridge** por producto, con tendencia lineal más 11 variables de mes (one-hot,
con enero como base). Ridge penaliza los coeficientes grandes (α = 1), lo que evita el
sobreajuste con pocos datos. Es explicable: cada coeficiente de mes es un índice estacional.
Con menos de 12 meses de historia usa solo tendencia.

**¿Cómo segmentan a los clientes?**
Con RFM (Recencia, Frecuencia y Monto) y **KMeans** con 4 grupos. La frecuencia y el monto se
pasan a logaritmo (son muy asimétricos) y todo se estandariza antes de agrupar. La calidad se
mide con el coeficiente **silhouette**, que va de −1 a 1. En producción da cerca de 0,35: una
separación moderada, típica de clientes reales que no forman grupos nítidos.

**¿Cómo detectan fraude sin ejemplos de fraude?**
Con **Isolation Forest**, que no necesita etiquetas: aísla los puntos raros con cortes
aleatorios, y los raros se aíslan en menos cortes. Usa 9 rasgos (monto en logaritmo, ítems,
unidades, hora codificada en seno y coseno, invitado, retiro, antigüedad de la cuenta y compras
previas), y espera un 2 % de anomalías. Cada alerta trae su explicación en palabras.

**¿Qué significa el lift en las recomendaciones?**
Lift = P(B | A) / P(B): cuánto más probable es comprar B si ya se compró A, comparado con
comprar B en general. Se recomiendan solo pares con lift > 1 y al menos 5 compras juntas.

**¿Cómo calculan cuánto reponer?**
Demanda diaria pronosticada × (14 días de proveedor + 30 días de cobertura), menos el stock
disponible (físico menos reservado). Es urgente si se agota antes de que llegue el proveedor.

**¿Por qué no aparecen elasticidades medidas?**
Porque se calculan sobre **cambios de precio reales** y todavía hay pocos. Por diseño no se
publica una cifra con menos de 14 días de ventana o menos de 10 unidades vendidas: un número
sin evidencia sería inventado. Se usa la **elasticidad de arco** (punto medio), que da el mismo
valor si el precio sube o baja. Es descriptiva, no causal: no controla estacionalidad ni
promociones, y así se rotula en pantalla.

---

## Legal

**¿Cómo cumplen el derecho de supresión si los pedidos deben conservarse?**
A los 30 días de la solicitud la cuenta se **anonimiza**: se borran correo, nombre, teléfono,
direcciones, 2FA, sesiones y segmentos de ML. Los pedidos se conservan sin datos personales,
porque el SII exige guardar la información tributaria. Si hay un pedido aún en despacho, se
posterga. *Ley:* 21.719. *Mostrar:* `executeDueDeletions` en
`src/lib/services/customer.service.ts`.

**¿Cuánto tiempo guardan la IP?**
12 meses en la bitácora. Después se anonimiza (IP y user-agent) y se conserva el registro de
la acción. *Mostrar:* [retencion-anonimizacion-datos.md](../retencion-anonimizacion-datos.md).

**¿Cómo implementan el retracto y la garantía?**
Retracto de 10 días (cambio o devolución del dinero) y garantía legal de 6 meses (cambio,
reparación o devolución), contados desde la entrega. *Ley:* 19.496. *Mostrar:*
[05-despacho-y-postventa.md](../codigo/05-despacho-y-postventa.md).

**¿La medición del sitio respeta el consentimiento?**
Sí. Sin "Aceptar medición" no se envía ningún evento. Aun con medición aceptada, el evento se
asocia a la cuenta solo con consentimiento comercial y si el navegador no envía Global Privacy
Control. Los dos botones del aviso tienen el mismo peso visual, sin patrones oscuros.

**¿Por qué no emiten boleta electrónica ni integran el tracking de los couriers?**
La boleta exige el certificado digital del contribuyente y la certificación del SII, o un
proveedor de pago. Las APIs de Starken, Correos de Chile y Blue Express son de pago y exigen
contrato, sin ambiente gratuito para desarrollo. Hoy el vendedor registra el número de
seguimiento y el cliente recibe el enlace a la página pública del courier.

---

## Calidad

**¿Cómo saben que funciona?**
Con 316 pruebas automatizadas:

- **247 unitarias** de lógica pura.
- **53 de integración** contra un PostgreSQL real, porque la concurrencia no se puede probar con
  *mocks*.
- **16 e2e** con Playwright en un navegador real, en escritorio y celular.

Todas corren en cada push (CI y E2E en GitHub Actions). *Mostrar:* el README, sección
"Calidad y pruebas".
