# Auditoría de seguridad, segunda ronda — Hachiko Store

**Fecha:** 25 de noviembre de 2026
**Alcance:** todo el código (web Next.js, API v1 de la app, Server Actions, pagos,
devoluciones, newsletter, subida de fotos, exportaciones, app Expo, pipeline ML y CI),
con foco en lo que **no cubrió** el [pentest de octubre](pentest-local-2026-10.md).
**Entorno de pruebas dinámicas:** solo el Docker local aislado (`docker compose up`,
`127.0.0.1:3000`, base desechable). No se tocó Vercel, Neon ni las pasarelas.

> Método: mapa de la superficie de ataque (todas las rutas, Server Actions y fronteras
> de confianza), revisión de código por clase (control de acceso, inyección, sesión,
> secretos, datos, cadena de suministro, lógica de negocio) y, para cada hallazgo,
> una prueba de concepto contra el Docker local **antes** y **después** de corregir.

---

## 1. Resumen

| Severidad | Hallazgo | Estado |
|---|---|---|
| Media | Login CSRF: un sitio ajeno podía dejar a la víctima conectada a la cuenta del atacante | ✅ Corregido |
| Media | Bloqueo de cuenta permanente con 1 intento cada 15 minutos (incluida la del vendedor) | ✅ Corregido |
| Baja | Enumeración de cuentas por el mensaje de bloqueo | ✅ Corregido |
| Baja | `cancelOrderAction` sin validar el tipo del id (operadores de Prisma desde el cliente) | ✅ Corregido |
| Baja | Refresh "legacy" sin registro aceptado sin límite de usos (código muerto) | ✅ Eliminado |
| Baja | Exportación de datos personales sin límite de frecuencia | ✅ Corregido |
| Baja | Eventos de analítica falsificables desde fuera del navegador | Riesgo aceptado (ver 4) |
| Baja | La cadena de hash de incidencias no usaba clave y no detectaba el borrado del final | ✅ Corregido (sello HMAC, ver 2.6) |

Ningún hallazgo permite escalar a vendedor, leer pedidos ajenos (IDOR), manipular un
pago ni ejecutar código.

---

## 2. Hallazgos corregidos

### 2.1 Login CSRF (Media)

**Dónde:** `src/lib/http-body.ts` (lo usan login, registro, recuperación, pagos y cuenta).

`readJsonBody` parseaba el cuerpo sin mirar `Content-Type` ni el origen. Un formulario
`<form enctype="text/plain">` en otro sitio puede armar un cuerpo que es JSON válido:

```html
<form action="https://…/api/auth/login" method="POST" enctype="text/plain">
  <input name='{"email":"atacante@…","password":"…","x":"' value='"}'>
</form>
```

Es una navegación de nivel superior, así que el navegador **guarda** las cookies de la
respuesta (también las `SameSite=Lax`). La víctima queda dentro de la cuenta del atacante;
si compra, el atacante ve en "Mis pedidos" su nombre, dirección y teléfono.

**Prueba (antes):** con Playwright, una página en `http://evil.test` envió el formulario:
respuesta `200`, cookie `hachiko_access` guardada y `/perfil` abierto **con la sesión
del atacante**.

**Corrección:** `readJsonBody` exige `Content-Type: application/json` (un formulario no
puede enviarlo, y un `fetch` de otro origen con ese tipo exige preflight CORS, que el sitio
no autoriza) y rechaza `Sec-Fetch-Site: cross-site`. El front ya enviaba JSON en todas sus
llamadas, así que no cambia nada para el usuario.

**Prueba (después):** `curl` con `text/plain` → `415`; la página de `evil.test` → `403`,
sin cookies, `/perfil` redirige a `/login`. El login normal sigue en `200`.
Regresión: `tests/unit/http-body.test.ts`.

### 2.2 Bloqueo de cuenta permanente (Media) y enumeración por bloqueo (Baja)

**Dónde:** `src/lib/services/auth.service.ts` (`registerFailedAttempt`, `loginUser`).

- Al vencer el bloqueo de 15 minutos, `failedLogins` seguía en 5: **un solo** intento
  errado volvía a bloquear. Con 1 petición cada 15 minutos un tercero mantenía bloqueada
  cualquier cuenta, incluida la del vendedor (la tienda no podría despachar).
- Mientras estaba bloqueada, cualquier contraseña recibía `ACCOUNT_LOCKED` (sin calcular el
  hash). Como un correo inexistente nunca se bloquea, 5 intentos revelaban si un correo
  tenía cuenta.

**Prueba (antes):** cuenta desechable bloqueada; se simuló el vencimiento en la base local;
un único intento errado → `failedLogins=6`, bloqueada otros 15 minutos, y el dueño con su
contraseña correcta recibía `ACCOUNT_LOCKED`.

**Corrección:** un bloqueo vencido deja el contador en cero; durante el bloqueo se verifica
la contraseña y solo quien la sabe ve `ACCOUNT_LOCKED` (los demás, `INVALID_CREDENTIALS`,
igual que un correo inexistente), y esos errores no alargan el bloqueo.

**Prueba (después):** mismo escenario → `failedLogins=1`, sin bloqueo, y el dueño entra.
Regresión: dos casos nuevos en `tests/integration/security-dispatch-analytics.test.ts`.

**Residual:** el bloqueo temporal (5 fallos → 15 min) sigue siendo un DoS acotado por diseño
(ver informe de octubre). Para eliminarlo: CAPTCHA tras N fallos.

### 2.3 Id sin validar en `cancelOrderAction` (Baja)

Las Server Actions reciben lo que mande el cliente, no solo strings. `cancelOrderAction`
pasaba `orderId` directo a Prisma: un objeto `{ "not": "x" }` llegaba como operador
(`deleteMany({ where: { orderId: { not: 'x' } } })` borraría las reservas de **todos** los
clientes). Hoy no era explotable porque el `create` siguiente falla y la transacción se
deshace, pero dependía de ese detalle. Ahora se valida con el mismo esquema que el resto.

### 2.4 Refresh "legacy" (Baja)

`rotateRefreshToken` aceptaba tokens sin `jti` (anteriores al registro de refresh del
2026-10-14) **sin límite de usos** y sin detección de reutilización. Esos tokens vencieron
a los 7 días, así que era código muerto; se eliminó y ahora se rechazan.

### 2.5 Exportación de datos sin límite (Baja)

`GET /api/me/data-export` descifra datos y escribe una solicitud y una auditoría por
llamada, sin tope. Ahora: 5 por hora por cuenta (el botón muestra el aviso).

### 2.6 Bitácora de incidencias sin clave (Baja)

**Dónde:** `src/lib/crypto/integrity.ts`, `src/lib/services/security.service.ts`.

Cada evento guardaba el SHA-256 del anterior, sin clave. Quien pudiera escribir en la base
(un insider, una credencial filtrada) podía alterar un evento y **recalcular toda la cadena**,
o **borrar los últimos eventos**: en ambos casos la verificación seguía diciendo "intacta".

**Corrección:** la incidencia guarda un **sello de la cabeza**: cuántos eventos tiene, el hash
del último y un HMAC-SHA256 de ambos con una clave derivada de `DATA_ENCRYPTION_KEY` (vive en
el entorno, no en la base). Cada evento nuevo vuelve a sellar en la misma transacción, y la
aplicación **no agrega eventos** sobre una bitácora cuyo sello no calza (así nunca "legaliza"
con su clave algo alterado). La verificación tiene tres estados: `VALID`, `BROKEN` (con el motivo)
y `UNSEALED` (sin sello). El hash de cada evento sigue siendo SHA-256 sin clave, para que una
autoridad pueda recalcular la cadena exportada sin conocer el secreto.

**Prueba (Docker):** el vendedor creó una incidencia y agregó una nota desde el panel →
"Integridad verificada". Se borró el último evento directo en la base → "⚠ Posible
manipulación en el evento 2 · Faltan 1 evento(s) al final de la bitácora".
Regresión: 7 casos en `tests/unit/integrity-chain.test.ts` (alteración con la cadena
recalculada, borrado del final, evento agregado por fuera, cabeza movida sin clave, otra clave,
sin sello) y 4 en `tests/integration/security-dispatch-analytics.test.ts` contra Postgres real.

**Residual:** quien tenga a la vez la base **y** `DATA_ENCRYPTION_KEY` puede volver a sellar
(con esa clave también descifra la PII, así que ya tiene todo). Quien guarde una copia vieja de
la base podría restaurarla entera (vuelta atrás): el informe exportado incluye `hashCabeza` y
`selloCabeza`, que sirven de ancla externa para detectarlo.

**Para producción (una vez, en este orden):**

1. Aplicar el esquema en Neon: `pnpm exec prisma db push`. Son 3 columnas nuevas con valor por
   defecto; el código anterior sigue funcionando con ellas.
2. Desplegar el código.
3. Sellar las incidencias existentes: `pnpm db:seal-incidents` (simulación) y luego
   `pnpm db:seal-incidents --apply`. Solo sella cadenas que verifican; una rota se informa y no se
   toca. Hasta hacerlo, las incidencias antiguas se ven "Sin sello" y no aceptan eventos nuevos.

**Aplicado en producción el 2026-11-25:** antes de `db push` se revisó el SQL exacto con
`prisma migrate diff` (solo las 3 columnas nuevas; ninguna otra diferencia). Antes de sellar se
comprobó que la `DATA_ENCRYPTION_KEY` local es la misma que usa Vercel: descifra los pedidos
hechos desde el sitio desplegado. Se desplegó el commit `1ad23a1` y se sellaron las 16
incidencias existentes; las 16 verifican `VALID` con la misma función que usa la aplicación.

---

## 3. Revisado y limpio

- **Control de acceso por función:** de las 27 rutas de `/api/v1`, las 21 privadas pasan por
  `requireSession` (las 19 de vendedor con `'SELLER'`); el catálogo y el login son públicos
  por diseño. De las 39 Server Actions, las de cuenta, compra y trastienda verifican sesión y
  rol (directo o vía `isSeller`, `sellerOrderStep`, `sellerStep`); las públicas (invitado,
  verificación de correo, newsletter) se apoyan en tokens firmados y rate limit. La subida de
  fotos exige SELLER antes de leer el archivo.
- **IDOR:** pedidos, devoluciones, pagos y la página de éxito filtran por `userId` de la
  sesión en la misma consulta.
- **Inyección:** no hay `$queryRaw`/`$executeRaw`; orden del catálogo por lista blanca; el
  pipeline de ML no arma SQL con f-strings.
- **XSS:** sin `dangerouslySetInnerHTML` salvo el JSON-LD (escapa `<`); los correos escapan
  todo dato de usuario o de producto.
- **SSRF:** `next/image` sin dominios remotos y el servidor no descarga URLs de usuarios.
- **Sesión:** JWE `dir`+`A256GCM` con algoritmos fijados; refresh de un solo uso con
  detección de reutilización; tokens de restablecimiento aleatorios, guardados con hash,
  de un solo uso, que invalidan las sesiones al usarse; tokens del newsletter con HMAC y
  comparación en tiempo constante.
- **Pagos:** firma de Mercado Pago obligatoria (sin secreto → rechaza) y en tiempo
  constante; monto y pedido confirmados con la pasarela; devoluciones con reclamo atómico
  antes de llamar a la pasarela.
- **Datos:** PII con AES-256-GCM e IV aleatorio; la exportación ARCOP es una lista blanca
  (sin hash de contraseña ni secreto 2FA); exportaciones en JSON (sin inyección de fórmulas).
- **Secretos y CI:** nada sensible versionado (`git ls-files`); sin `pull_request_target`;
  los secretos del CI no llegan a forks.

---

## 4. Riesgos aceptados y recomendaciones

- **Analítica falsificable (Baja).** `/api/analytics` es público por naturaleza: el filtro de
  `Origin` frena a navegadores, no a `curl` (se insertaron 5 búsquedas falsas en la prueba).
  El impacto se limita a ensuciar la vista Conversión (120 eventos/min/IP). Mitigación
  posible: emitir el `sessionId` en una cookie firmada por el servidor.
- **Rate limit en producción (verificar).** Sin `UPSTASH_REDIS_REST_URL/TOKEN` en Vercel, los
  límites cuentan por instancia. Confirmar que esas variables estén configuradas.
- **Sesión de 15 minutos tras eliminar la cuenta o cerrar sesión (Info).** El access token
  no se consulta contra la base; dura como máximo 15 minutos. Es el compromiso habitual de
  los tokens sin estado.
- **Eliminar la cuenta no pide la contraseña otra vez (Info).** Requiere la sesión de la
  propia persona y no es explotable por CSRF (método DELETE con JSON).
