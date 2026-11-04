# 10. Seguridad y privacidad en el código

Este documento es el **mapa de dónde vive cada control**. El cruce control por control con el
OWASP Top 10 está en [seguridad-owasp.md](../seguridad-owasp.md) y las pruebas de ataque en
[pentest-local-2026-10.md](../pentest-local-2026-10.md). La teoría está en
[../teoria/03-seguridad.md](../teoria/03-seguridad.md).

## Capas de defensa

| Capa | Control | Dónde |
|---|---|---|
| Navegador | CSP con *nonce* por respuesta y `strict-dynamic`. Para scripts no hay `unsafe-inline`, ni `unsafe-eval` en producción. Los estilos sí admiten `unsafe-inline`, porque no ejecutan código | `buildCsp` en [middleware.ts](../../src/middleware.ts) |
| Navegador | HSTS (2 años, `preload`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy` (sin cámara, micrófono ni ubicación) | [next.config.ts](../../next.config.ts) |
| Navegador | `frame-ancestors 'none'` (*clickjacking*) y `form-action` limitado al propio sitio y a Transbank | CSP |
| Sesión | Tokens JWE cifrados; cookies `HttpOnly`, `Secure` y `SameSite=Strict`; rotación con detección de reutilización | [02-autenticacion.md](02-autenticacion.md) |
| Acceso | RBAC en tres capas: middleware, layout del panel y cada acción o ruta | [rbac.ts](../../src/lib/auth/rbac.ts), [v1.ts](../../src/lib/api/v1.ts) |
| Acceso | **Propiedad de los recursos:** los pedidos se buscan siempre `WHERE id = ? AND userId = sesión` (por ejemplo, `getOrderForClient` y `getUnpaidOrderForUser`), contra IDOR | [order.service.ts](../../src/lib/services/order.service.ts) |
| Entrada | zod en el servidor, tope de tamaño del cuerpo y ids acotados | [schemas.ts](../../src/lib/validation/schemas.ts), [http-body.ts](../../src/lib/http-body.ts) |
| Entrada | Archivos: firma real de las imágenes; Excel revisado antes de abrirse (bombas zip, macros, XXE) | [product-image.ts](../../src/lib/product-image.ts), [upload-guard.ts](../../src/lib/upload-guard.ts) |
| Abuso | Límites de frecuencia por IP, usuario y vendedor; bloqueo de cuenta a los 5 fallos | [rate-limit.ts](../../src/lib/rate-limit.ts), [07-backend.md](07-backend.md) |
| Integraciones | Firma HMAC del webhook de Mercado Pago; datos del pago siempre consultados a la pasarela; secreto del cron en tiempo constante | [04-pagos-y-reembolsos.md](04-pagos-y-reembolsos.md), [cron.ts](../../src/lib/auth/cron.ts) |
| Datos | Datos personales cifrados en la base (AES-256-GCM) | [pii.ts](../../src/lib/crypto/pii.ts) |
| Rastro | Bitácora de acciones y bitácora de incidencias encadenada por hash | [audit.service.ts](../../src/lib/services/audit.service.ts), [security.service.ts](../../src/lib/services/security.service.ts) |

## Qué datos se cifran

Con AES-256-GCM se cifran, con un IV aleatorio de 12 bytes por valor y la etiqueta de
autenticación guardada junto al texto cifrado (`iv:tag:texto` en hexadecimal):

- en cada pedido: nombre, teléfono, calle, número y departamento del destinatario;
- en las direcciones guardadas: nombre, calle, número, departamento y teléfono;
- el teléfono del perfil;
- el secreto del doble factor.

La clave es `DATA_ENCRYPTION_KEY`: 32 bytes en hexadecimal, validada al arrancar. **No se puede
cambiar sin una migración que vuelva a cifrar los datos**, porque lo cifrado con la clave
anterior dejaría de poder leerse.

Las contraseñas no se cifran sino que se *hashean* con argon2id, y los tokens de correo se
guardan solo como hash SHA-256. Ninguno de los dos se puede recuperar desde la base.

## Bitácora (`AuditLog`)

Cada acción relevante deja un registro con actor, rol, acción, objeto, metadatos, IP y
user-agent. Hay unas 40 acciones distintas: login correcto y fallido, bloqueo, reutilización
de refresh token, activación del 2FA, pedido creado o cancelado, pago iniciado, confirmado o
fallido, reembolso, ajuste de stock, devoluciones, exportación de datos, eliminación de cuenta
y todo el ciclo de las incidencias. Los cambios de precio quedan en su propia tabla
(`PriceHistory`).

El panel de Seguridad muestra **conteos y eventos, no el detalle de los clientes**
(`SECURITY_ACTIONS`).

## Incidencias de seguridad

`/trastienda/seguridad` permite registrar y seguir incidentes:

- **Categorías alineadas con la Ley 21.459:** ataque a la integridad de un sistema, acceso
  ilícito, interceptación, ataque a la integridad de los datos y fraude informático. Además,
  vulneración de datos personales (Ley 21.719), phishing y abuso de credenciales.
- **Severidad:** baja, media, alta o crítica.
- **Estados:** abierta, investigando, contenida, resuelta, denunciada o notificada a la
  autoridad, y cerrada.
- Cada nota o cambio de estado es un evento de la **bitácora encadenada**: lleva el hash
  SHA-256 del evento anterior, y `verifyChain` detecta cualquier alteración, eliminación o
  cambio de orden ([integrity.ts](../../src/lib/crypto/integrity.ts)).
- **Informe para autoridades** (`buildIncidentReport`): un JSON autocontenido con la incidencia,
  su bitácora y la prueba de integridad, **sin datos personales de clientes**. Está pensado para
  la Agencia de Protección de Datos, el CSIRT Nacional, la PDI o la Fiscalía.

## Derechos del titular (Ley 21.719)

Desde `/datos`, el cliente puede:

| Derecho | Cómo |
|---|---|
| Acceso y portabilidad | Descarga un JSON con su perfil, direcciones y pedidos, descifrados (`exportUserData`, `/api/me/data-export`) |
| Rectificación | Edita su perfil desde `/perfil`. La dirección guardada se actualiza con la del último despacho |
| Supresión | Solicita eliminar la cuenta. A los **30 días** se anonimiza (`executeDueDeletions`): se borran correo, nombre, teléfono, direcciones, 2FA, sesiones, segmentos de ML y suscripción, y se conservan los pedidos sin datos personales por la obligación tributaria. Si hay un pedido en despacho, se posterga |
| Oposición y consentimiento | Activa o desactiva el consentimiento comercial |

## Retención

- **IP y user-agent de la bitácora: 12 meses** (`AUDIT_PII_RETENTION_DAYS = 365`). Después se
  anonimizan y se conserva el resto del registro. El detalle está en
  [retencion-anonimizacion-datos.md](../retencion-anonimizacion-datos.md).
- **Suscripciones al newsletter no confirmadas:** se purgan a los 30 días.
- **Refresh tokens vencidos:** se borran a diario.

## Consentimiento y medición

- El aviso de cookies ofrece **dos opciones con el mismo estilo**, sin patrones oscuros:
  "Solo esenciales" o "Aceptar medición". Las cookies de sesión y pago y el carrito no
  necesitan consentimiento.
- **Sin medición aceptada, no se envía ningún evento.** Con medición aceptada, el evento se
  asocia a la cuenta solo con consentimiento comercial y sin la señal Global Privacy Control
  (`Sec-GPC: 1`).
- El newsletter usa **doble confirmación**: no se envía nada hasta que la persona confirma
  desde su correo.

## Secretos

- Todos los secretos viven en variables de entorno (Vercel en producción, `.env` local sin
  versionar). `env.ts` valida que existan al arrancar.
- En la app móvil **ninguna variable `EXPO_PUBLIC_*` es secreta**, porque esas variables se
  incluyen en el paquete que se instala en el teléfono. La app solo conoce la URL pública de la
  API.
