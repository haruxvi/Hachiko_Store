# Seguridad de la aplicación — OWASP Top 10 y gestión de vulnerabilidades

Mapeo del **OWASP Top 10 (2021)** a los controles implementados en este repositorio, más el
proceso de gestión de vulnerabilidades de dependencias (CVE / NVD).

Cada control referencia el archivo donde vive, para que la afirmación sea verificable.

---

## OWASP Top 10 → controles implementados

### A01 — Broken Access Control

| Control | Dónde |
|---|---|
| RBAC con dos roles y mínimo privilegio (CLIENT compra, SELLER opera; no existe superusuario) | `src/lib/auth/rbac.ts`, `prisma/schema.prisma` (enum `Role`) |
| Middleware que protege `/trastienda` (solo SELLER) y rutas de cuenta (autenticados) | `src/middleware.ts` |
| Verificación de rol **también** en cada route handler y server action (el middleware es la primera capa, no la única) | `requireRole()` en todas las rutas de `src/app/api/**` |
| Las órdenes solo son accesibles por su dueño (`getUnpaidOrderForUser` filtra por `userId`) — sin IDOR | `src/lib/services/order.service.ts` |
| Eliminación de cuenta restringida al propio CLIENT | `src/app/api/me/account/route.ts` |

### A02 — Cryptographic Failures

| Control | Dónde |
|---|---|
| Contraseñas con **Argon2id** (memoryCost 64 MiB, timeCost 3, parallelism 4) | `src/lib/services/auth.service.ts` |
| PII (teléfonos, direcciones de despacho) cifrada **AES-256-GCM** con IV aleatorio por valor | `src/lib/crypto/pii.ts` |
| Secreto TOTP almacenado cifrado, nunca en claro | `src/lib/services/auth.service.ts` |
| JWT firmados HS256 con secreto ≥ 32 chars validado al arranque | `src/lib/auth/jwt.ts`, `src/lib/env.ts` |
| Cookies `httpOnly`, `secure` en producción, `SameSite=Strict`; refresh con path restringido | `src/lib/auth/session.ts` |
| HSTS con preload (2 años) | `next.config.ts` |

### A03 — Injection

| Control | Dónde |
|---|---|
| Acceso a datos exclusivamente vía **Prisma** (consultas parametrizadas; sin SQL concatenado) | `src/lib/db.ts`, servicios |
| Validación de **toda** entrada externa con Zod antes de tocar la lógica | `src/lib/validation/schemas.ts`, usado en cada route/action |
| React escapa la salida por defecto; no se usa `dangerouslySetInnerHTML` | componentes |
| CSP restrictivo como defensa en profundidad contra XSS | `next.config.ts` |

### A04 — Insecure Design

| Control | Dónde |
|---|---|
| Reserva de stock con TTL + transacción `Serializable` (no se vende stock inexistente ni hay carrera entre compradores) | `src/lib/services/order.service.ts` |
| El monto y el `orderId` del pago salen de la respuesta **firmada del proveedor**, nunca del cliente | `src/app/api/payments/webpay/commit/route.ts`, webhook MP |
| Bloqueo de cuenta tras 5 fallos (15 min) y verificación de relleno para no filtrar qué emails existen (timing) | `src/lib/services/auth.service.ts` |
| 2FA TOTP (RFC 6238): se pide solo tras validar contraseña (no revela qué cuentas lo tienen); desactivarlo exige código vigente | `src/lib/services/auth.service.ts`, `src/lib/auth/totp.ts` |
| Bitácora de incidencias **append-only** encadenada por hash SHA-256 (alterar un evento rompe la cadena) | `src/lib/crypto/integrity.ts` |

### A05 — Security Misconfiguration

| Control | Dónde |
|---|---|
| Headers: HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` | `next.config.ts` |
| `poweredByHeader: false` (no se anuncia el framework) | `next.config.ts` |
| Variables de entorno validadas con Zod al arranque: configuración inválida = la app no levanta | `src/lib/env.ts` |
| Endpoints de cron cerrados por defecto si falta `CRON_SECRET` (fail-closed) | `src/lib/auth/cron.ts` |
| Swagger UI **solo en desarrollo**; en producción `/api/docs` es 404 | `src/app/api/docs/route.ts` |

### A06 — Vulnerable and Outdated Components

Ver [Gestión de vulnerabilidades](#gestión-de-vulnerabilidades-de-dependencias-cve--nvd) más abajo.

| Control | Dónde |
|---|---|
| `pnpm audit --audit-level=moderate` bloquea el pipeline de CI | `.github/workflows/ci.yml` |
| Audit semanal nivel `low` + `pnpm outdated`; si falla, abre un issue etiquetado `security` | `.github/workflows/deps-audit.yml` |
| Lockfile congelado en CI (`--frozen-lockfile`) — sin resoluciones sorpresa | `.github/workflows/ci.yml` |
| Versiones exactas (sin `^`) en dependencias críticas: prisma, argon2, jose, SDKs de pago | `package.json` |

### A07 — Identification and Authentication Failures

| Control | Dónde |
|---|---|
| Política de contraseñas (≥ 8, mayúscula, número) validada en servidor | `src/lib/validation/schemas.ts` |
| Rate limit en login (10/min/IP), registro (5/min/IP) y refresh (30/min/IP) | rutas de `src/app/api/auth/**` |
| Access token corto (15 min) + refresh rotativo (7 días) con revocación por `tokenVersion` (logout cierra todos los dispositivos) | `src/lib/auth/jwt.ts`, `src/app/api/auth/refresh/route.ts` |
| Un refresh token no sirve como access token (claim `type` verificado estrictamente) | `src/lib/auth/jwt.ts` |
| El refresh re-verifica contra la BD: cuentas eliminadas/bloqueadas no renuevan sesión | `src/app/api/auth/refresh/route.ts` |

### A08 — Software and Data Integrity Failures

| Control | Dónde |
|---|---|
| Webhook de Mercado Pago: verificación de firma HMAC + **idempotencia** por `x-request-id` | `src/app/api/payments/mp/webhook/route.ts`, `ProcessedWebhook` |
| Confirmación Webpay contra Transbank (commit servidor-a-servidor), nunca confiando en el redirect | `src/app/api/payments/webpay/commit/route.ts` |
| Cadena de integridad SHA-256 en bitácoras de incidencias, con verificación (`verifyChain`) | `src/lib/crypto/integrity.ts` |
| CI con lockfile congelado y auditoría de dependencias | `.github/workflows/ci.yml` |

### A09 — Security Logging and Monitoring Failures

| Control | Dónde |
|---|---|
| `AuditLog` de acciones sensibles: login/fallos/bloqueos, pagos, despachos, exportaciones de datos, cambios de consentimiento, 2FA | `src/lib/services/audit.service.ts` |
| Registro de incidencias de ciberseguridad tipificado según Ley 21.459, con notificación a autoridad (Ley 21.663 / 21.719) | `prisma/schema.prisma` (`SecurityIncident`), `src/lib/services/security.service.ts` |
| Sentry para errores en runtime | `@sentry/nextjs`, `src/instrumentation.ts` |
| Anonimización programada de IP y user-agent de auditoría a los 12 meses (cron diario) — ver [`docs/retencion-anonimizacion-datos.md`](./retencion-anonimizacion-datos.md) | `src/app/api/cron/clean-audit-logs/route.ts` |

### A10 — Server-Side Request Forgery (SSRF)

| Control | Dónde |
|---|---|
| El servidor solo llama hosts fijos: API de Transbank, Mercado Pago y Resend vía SDKs oficiales; **ninguna URL saliente se construye con entrada del usuario** | `src/lib/payments/*`, servicios |
| `connect-src` del CSP limitado a los dominios de pago | `next.config.ts` |

---

## Gestión de vulnerabilidades de dependencias (CVE / NVD)

Proceso permanente, alineado con OWASP A06 y con la base de datos pública **NVD**
(nvd.nist.gov), donde MITRE publica los CVE.

### Detección (automática)

1. **En cada push/PR**: `pnpm audit --audit-level=moderate` corre en CI y **bloquea el merge**
   si hay CVE de severidad moderada o superior con fix disponible.
2. **Semanal (lunes 09:00 UTC)**: `deps-audit.yml` corre `pnpm audit --audit-level=low` +
   `pnpm outdated`. Si detecta algo, **abre un issue** con etiquetas `security` y
   `dependencies`.
3. **Manual**: `pnpm audit` / `pnpm audit:full` / `pnpm deps:check` en local.

### Triage y SLA de remediación

Al recibir un aviso (issue del workflow o advisory de GitHub):

| Severidad (CVSS) | Plazo máximo de remediación |
|---|---|
| Crítica (9.0–10) | 24 horas |
| Alta (7.0–8.9) | 72 horas |
| Media (4.0–6.9) | 2 semanas |
| Baja (< 4.0) | Próximo ciclo de mantención |

Para cada CVE: verificar en la NVD (`https://nvd.nist.gov/vuln/detail/CVE-XXXX-XXXXX`) si el
vector aplica al uso real (¿el código vulnerable es alcanzable desde nuestra superficie?).
Si no aplica, se documenta la excepción en el issue antes de cerrarlo; si aplica, se
actualiza la dependencia y se corre la suite completa (`pnpm typecheck && pnpm lint && pnpm test`).

### Si la vulnerabilidad es propia (no de una dependencia)

Se registra como **incidencia** en el módulo de Seguridad de la trastienda
(`/trastienda/seguridad`), que mantiene la bitácora encadenada por hash y el flujo de
notificación a la autoridad cuando corresponde (datos personales → Agencia de Protección de
Datos, Ley 21.719; ver `docs/deploy.md` §2.3).

---

## Decisiones de seguridad documentadas (excepciones conocidas)

- **`script-src 'unsafe-inline'` en el CSP**: requerido por los scripts inline de Next.js
  App Router sin nonces. Mitigado por el escape por defecto de React y la ausencia de
  `dangerouslySetInnerHTML`. Pendiente: migrar a CSP con nonce cuando Next lo haga ergonómico
  en este stack.
- **Rate limiting en memoria por instancia** (`src/lib/rate-limit.ts`): en serverless es
  best-effort. El bloqueo de cuenta por intentos fallidos (persistente en BD) es el control
  principal contra fuerza bruta; el rate limit es capa adicional. Si el volumen lo justifica,
  migrar a un store compartido (Upstash Redis).
- **`<img>` en vez de `next/image`** para imágenes de producto: las URLs son externas y sin
  host fijo (aún no se define el hosting de imágenes), y `next/image` exige `remotePatterns`.
  Se compensa con `loading="lazy"` / `decoding="async"` y `fetchPriority="high"` en la imagen
  LCP. Revisitar al definir el bucket/CDN definitivo.
