# 7. El backend

El backend de Hachiko **no es un servidor aparte**: es la parte de servidor de la misma
aplicación Next.js. En producción corre en Vercel como funciones serverless de Node 20. Cada
petición levanta (o reutiliza) una instancia, ejecuta el código y responde.

## Las puertas de entrada

| Tipo | Archivo | Quién lo usa | Autenticación |
|---|---|---|---|
| **Middleware** | [middleware.ts](../../src/middleware.ts) | Todas las páginas HTML (no corre en `/api` ni en archivos estáticos) | Lee la cookie de acceso solo para decidir redirecciones |
| **Server Components** | `src/app/**/page.tsx` | La web, al renderizar | Leen la sesión con `getSession()` |
| **Server Actions** | `src/actions/*.ts` | Los formularios y botones de la web | Cookie de sesión. Cada acción revisa la sesión y el rol por sí misma |
| **Route handlers** | `src/app/api/**/route.ts` | Login, pagos, webhooks, crons, analítica, exportación de datos | Según el caso: cookie, firma de la pasarela o secreto del cron |
| **API v1** | `src/app/api/v1/**` | La app móvil | `Authorization: Bearer <access>` |

Ninguna de estas puertas tiene reglas de negocio propias. Su trabajo es autenticar, limitar la
frecuencia, validar la entrada con zod y llamar a un servicio.

## Servicios: donde viven las reglas

`src/lib/services/` tiene un archivo por área:

| Servicio | Responsabilidad |
|---|---|
| `auth.service.ts` | Registro, login, bloqueo, invitados, 2FA |
| `account-token.service.ts` | Recuperar contraseña y verificar correo |
| `catalog.service.ts` | Categorías y productos (lectura y edición), historial de precios |
| `inventory.service.ts` | Stock, reservas, ajustes, transacciones Serializable con reintento |
| `order.service.ts` | Crear, cancelar, despachar y entregar pedidos |
| `payment.service.ts` | Confirmar pagos, idempotencia de webhooks, reembolsos |
| `pickup.service.ts` | Retiro en tienda: plazo, recordatorios, "no retirado" |
| `returns.service.ts` | Cambios y devoluciones (retracto y garantía) |
| `customer.service.ts` | Perfil, direcciones, exportación de datos, eliminación de cuenta |
| `audit.service.ts` | Bitácora (`AuditLog`) y su anonimización |
| `security.service.ts` | Monitoreo, incidencias con cadena de hash, informe para autoridades |
| `analytics.service.ts` | Embudo de conversión y carritos abandonados |
| `newsletter.service.ts` | Suscripción con doble confirmación y campañas |
| `dashboard.service.ts` | Resumen del inicio de la trastienda |
| `intelligence.service.ts` | Lectura de los modelos y BI en vivo |
| `elasticity.service.ts` | Elasticidad-precio sobre cambios de precio reales |

Cuando la web y la app hacen lo mismo, ambas llaman al mismo módulo. Por ejemplo,
[catalog-admin.ts](../../src/lib/catalog-admin.ts) y
[product-import.ts](../../src/lib/product-import.ts) los usan tanto las Server Actions del
panel como la API v1 del vendedor.

## Acceso a datos

- [db.ts](../../src/lib/db.ts) crea **un único `PrismaClient`** y, en desarrollo, lo guarda en
  `globalThis` para que la recarga en caliente no abra una conexión nueva en cada cambio.
- En producción la app usa la conexión **con pooler** de Neon (`DATABASE_URL`), pensada para
  muchas funciones serverless cortas. Las migraciones y el pipeline de ML usan la **directa**
  (`DIRECT_URL`).
- Todas las consultas pasan por Prisma o por `Prisma.sql` parametrizado: no se arma SQL
  concatenando texto del usuario.
- Las operaciones que no pueden quedar a medias (crear pedido, confirmar pago, ajustar stock,
  carga masiva) corren en una transacción **Serializable** con `withSerializableRetry`.

## Validación de entradas

Todos los esquemas están en [schemas.ts](../../src/lib/validation/schemas.ts) (zod 4). Se
valida **en el servidor**, aunque el formulario ya haya validado en el navegador. Además:

- Los cuerpos JSON se leen con un tope de tamaño (16 KB por defecto) y responden 413 si lo
  superan ([http-body.ts](../../src/lib/http-body.ts)).
- Los ids se acotan en largo y alfabeto (letras, números y guiones, hasta 64 caracteres):
  `routeId` en la API v1 responde 404 si el id de la URL no cumple, y `DbIdSchema` hace lo
  mismo con los ids que vienen en el cuerpo (por ejemplo, los del carrito).

## Formato de respuestas y errores (API v1)

El envoltorio `api()` de [v1.ts](../../src/lib/api/v1.ts) hace que toda la API v1 responda igual:

```json
{ "ok": true,  "data": { ... } }
{ "ok": false, "error": { "code": "FORBIDDEN", "message": "Sin permisos" } }
```

- Un `ApiError` lanzado en cualquier punto se convierte en su código HTTP y mensaje.
- Cualquier otro error se registra en el log del servidor y responde **500 con un mensaje
  genérico**. Nunca sale un *stack trace* ni un error de Prisma hacia afuera.
- Las respuestas llevan `Cache-Control: private, no-store`, porque pueden traer datos de la
  cuenta.
- CORS solo existe **en desarrollo**, para la vista previa web de Expo. La app instalada no lo
  necesita.
- Las respuestas al exterior pasan por DTO ([dto.ts](../../src/lib/api/dto.ts)): se elige qué
  campos salen, de modo que nunca se filtra un campo interno por accidente.

La referencia completa de endpoints está en [api.md](../api.md) y en la especificación OpenAPI
3.1 ([openapi.json](../api/openapi.json)). Swagger UI (`/api/docs`) existe **solo en
desarrollo**: en producción responde 404.

## Límites de frecuencia

[rate-limit.ts](../../src/lib/rate-limit.ts) implementa una **ventana fija por clave** (IP,
usuario o vendedor):

- Si están configuradas `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`, el contador
  vive en Redis y lo comparten todas las instancias.
- Si no, cada instancia cuenta por su cuenta en memoria, como mejor esfuerzo.

| Qué | Límite |
|---|---|
| Login | 10 por minuto por IP |
| Registro | 5 por minuto por IP |
| Invitado | 5 por minuto por IP |
| Recuperar contraseña | 5 cada 15 minutos por IP |
| Restablecer contraseña | 10 por minuto por IP |
| Renovar sesión | 30 por minuto por IP |
| Crear pedido | 12 cada 5 minutos por usuario y 20 por IP |
| Solicitar devolución | 5 por hora por usuario |
| Subir fotos | 40 por minuto |
| Carga masiva | 30 cada 10 minutos por vendedor |
| API v1 | Catálogo 120/min, cuenta 60/min, vendedor 120/min (lectura) y 30/min (escritura) |
| Analítica | 120 por minuto por IP |

## Configuración y arranque

- [instrumentation.ts](../../src/instrumentation.ts) se ejecuta **una vez al iniciar el
  servidor** e importa [env.ts](../../src/lib/env.ts). Ese módulo valida con zod que existan
  todas las variables obligatorias (base de datos, secretos, llaves de pago, URL pública,
  `CRON_SECRET`…). Si falta una, el servidor **no arranca**, en vez de fallar a mitad de un
  pago.
- Hay variables opcionales: sin `RESEND_API_KEY`, los correos se omiten con un aviso en el log;
  sin `MP_WEBHOOK_SECRET`, el webhook de Mercado Pago rechaza todo.

## Correos

[email.ts](../../src/lib/email.ts) envía por Resend con HTML propio: pago confirmado, despacho
con enlace de seguimiento, reembolso, recuperación de contraseña, verificación de correo, aviso
de cuenta existente, recordatorios de retiro, retiro no buscado y avance de las devoluciones.
Las plantillas del newsletter están en [newsletter/templates.ts](../../src/lib/newsletter/templates.ts). **`sendEmail` nunca lanza error**: si el correo falla, la
operación de negocio (por ejemplo, un pago) no se revierte.

## Tareas programadas

| Cron (Vercel, `vercel.json`) | Hora (UTC) | Qué hace |
|---|---|---|
| `/api/cron/clean-reservations` | 03:00 | Borra reservas vencidas, cierra checkouts abandonados del embudo y envía recordatorios de retiro |
| `/api/cron/clean-audit-logs` | 04:00 | Anonimiza la IP y el user-agent de la bitácora con más de 12 meses, purga suscripciones a newsletter no confirmadas, ejecuta las eliminaciones de cuenta vencidas y borra refresh tokens vencidos |

Ambos exigen `Authorization: Bearer $CRON_SECRET`, comparado en tiempo constante. **Sin
secreto configurado, responden 401** ([cron.ts](../../src/lib/auth/cron.ts)).

El entrenamiento de ML no corre en Vercel, sino en GitHub Actions (ver
[12-operacion.md](12-operacion.md)).
