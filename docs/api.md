# API de Hachiko — documentación

El contrato de la API está definido en **OpenAPI 3.1** con una única fuente de verdad:
[`src/lib/docs/openapi.ts`](../src/lib/docs/openapi.ts).

## Cómo consultarla

| Forma | Cómo | Disponibilidad |
|---|---|---|
| **Swagger UI** (interactivo) | `pnpm dev` → http://localhost:3000/api/docs | Solo desarrollo (en producción es 404, a propósito) |
| JSON crudo | http://localhost:3000/api/docs/spec | Solo desarrollo |
| Archivo estático | [`docs/api/openapi.json`](api/openapi.json) — regenerar con `pnpm docs:api` | Siempre (versionado en git) |

> Importable directo en Postman/Insomnia o visualizable con
> `npx @redocly/cli preview-docs docs/api/openapi.json`.

## Resumen de endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | — | Registro + consentimiento (Ley 21.719); deja sesión iniciada |
| POST | `/api/auth/login` | — | Login con Argon2id; 2FA TOTP si está activo; bloqueo tras 5 fallos |
| POST | `/api/auth/forgot-password` | — | Envía enlace de recuperación (un solo uso, 60 min; anti-enumeración) |
| POST | `/api/auth/reset-password` | — | Fija contraseña nueva con el token; revoca todas las sesiones |
| POST | `/api/auth/refresh` | cookie refresh | Renueva tokens; revalida estado del usuario y `tokenVersion` |
| POST | `/api/auth/logout` | cookie access | Revoca todos los refresh tokens (todos los dispositivos) |
| GET | `/api/me/data-export` | CLIENT/SELLER | Exportación de datos personales (derecho de acceso) |
| DELETE | `/api/me/account` | CLIENT | Solicitud de eliminación (purga a 30 días) |
| POST | `/api/payments/webpay/create` | CLIENT/SELLER | Crea transacción Webpay Plus para orden propia UNPAID |
| GET | `/api/payments/webpay/commit` | — (retorno TBK) | Confirma contra Transbank y redirige a éxito/fallo |
| POST | `/api/payments/mp/preference` | CLIENT/SELLER | Crea preferencia Checkout Pro |
| POST | `/api/payments/mp/webhook` | firma HMAC | Notificaciones de pago MP (idempotente por `x-request-id`) |
| GET | `/api/security/incidents/{id}/export` | SELLER | Informe JSON de incidencia con cadena de integridad |
| GET | `/api/cron/clean-reservations` | Bearer CRON_SECRET | Libera reservas de stock expiradas (cada 5 min) |
| GET | `/api/cron/clean-audit-logs` | Bearer CRON_SECRET | Anonimiza IP y user-agent de auditoría a los 12 meses (diario 04:00 UTC) |
| GET | `/api/health` | — | Healthcheck con verificación de BD |

## Convenciones

- **Autenticación**: cookies httpOnly `hachiko_access` (JWT, 15 min) y `hachiko_refresh`
  (7 días, path `/api/auth/refresh`). No hay tokens en headers ni en localStorage.
- **Errores**: siempre `{ ok: false, error: { code, message } }` — `code` estable para
  máquinas, `message` en español para personas.
- **Rate limiting**: 429 con header `Retry-After` en auth (login 10/min, registro 5/min,
  refresh 30/min por IP).
- **Mutaciones del panel y la cuenta** (productos, categorías, inventario, despacho,
  perfil, 2FA, verificación de email): van por **Server Actions** (`src/actions/*`), no por
  REST — Next.js las protege con verificación de origen, y cada una revalida sesión, rol y
  esquema Zod.
- **Checkout como invitado**: `startGuestCheckoutAction` (server action) crea una cuenta
  CLIENT con contraseña aleatoria y deja sesión iniciada; el resto del flujo no cambia.
  Si el email ya existe NO se entrega sesión (evita tomar el historial de otra persona):
  se redirige a login / recuperar contraseña. El invitado reclama su cuenta fijando
  contraseña vía `/recuperar`.
- **Método de entrega**: el cliente lo elige en el checkout (`PICKUP`, `STARKEN`,
  `CORREOS_CHILE`) y queda fijo en la orden (`Order.shippingMethod`). Toda visualización
  posterior (correos, mis pedidos, trastienda) usa solo ese método, vía
  `src/lib/shipping.ts` (única fuente de verdad de etiquetas, costos y URLs de tracking).

## Regla de mantenimiento

Todo cambio en `src/app/api/**` actualiza `src/lib/docs/openapi.ts` **en el mismo commit**
y regenera el archivo estático con `pnpm docs:api` (parte de la Definition of Done).
