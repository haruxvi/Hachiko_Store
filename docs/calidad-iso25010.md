# Calidad del producto — ISO/IEC 25010 (familia SQuaRE / ISO 25000)

Evaluación del producto contra las ocho características de calidad de **ISO/IEC 25010**, con
los mecanismos concretos que las sostienen y cómo se verifican. Este documento es la
referencia de calidad de producto del plan SQA (`docs/plan-sqa-ieee730.md`).

## 1. Adecuación funcional

Las funciones cubren el alcance acordado: catálogo, carrito, checkout con Webpay y Mercado
Pago, gestión de inventario con trazabilidad de movimientos, despacho, derechos ARCO
(exportación/eliminación de datos) y registro de incidencias de ciberseguridad.

- **Verificación**: checklist end-to-end de `docs/deploy.md` §1.7 y guía de pruebas
  (`docs/guia-de-pruebas.md`).

## 2. Eficiencia de desempeño

| Mecanismo | Dónde |
|---|---|
| Índices en todos los caminos de consulta calientes (slug, stock, estados de orden, fechas) | `prisma/schema.prisma` (`@@index`) |
| `select`/`include` acotados: las consultas traen solo las columnas que la vista usa | servicios en `src/lib/services/**` |
| Consultas independientes en paralelo (`Promise.all`) en páginas y servicios | p. ej. `src/app/page.tsx` |
| Singleton de PrismaClient (sin agotar conexiones en dev/serverless) | `src/lib/db.ts` |
| Llave AES y secreto JWT cacheados en memoria (no se re-derivan por request) | `src/lib/crypto/pii.ts`, `src/lib/auth/jwt.ts` |
| Imágenes de grilla con `loading="lazy"`; imagen LCP con `fetchPriority="high"` | páginas de storefront |
| `argon2` importado dinámicamente: solo carga en rutas de auth, no en cada cold start | `src/lib/services/auth.service.ts` |
| Paginación del catálogo (24 por página) | `src/app/(storefront)/catalogo/page.tsx` |

- **Métrica objetivo**: respuestas de API < 500 ms p95 (excluido el round-trip a pasarelas);
  Lighthouse Performance ≥ 90 en home y catálogo antes del go-live.

## 3. Compatibilidad

- API REST con contrato OpenAPI 3.1 publicado (`docs/api/openapi.json`, Swagger UI en
  `/api/docs` en desarrollo): cualquier cliente puede integrarse contra el contrato.
- Webhooks/retornos compatibles con los contratos oficiales de Mercado Pago y Transbank
  (SDKs oficiales `mercadopago` y `transbank-sdk`).

## 4. Usabilidad

- UI en español chileno, precios en CLP con `toLocaleString('es-CL')`.
- Mensajes de error legibles y accionables (los códigos quedan para las máquinas, el
  `message` para las personas).
- Formularios con validación inmediata (react-hook-form + resolvers de los mismos esquemas
  Zod del servidor: una sola definición de reglas).
- Imágenes con `alt`, flujo 2FA con alternativa manual al QR.

## 5. Fiabilidad

| Mecanismo | Dónde |
|---|---|
| Transacciones `Serializable` en creación de orden + reserva de stock (sin estados a medias) | `src/lib/services/order.service.ts` |
| Idempotencia de webhooks (reintentos de MP no duplican efectos) | `payment.service.ts`, `ProcessedWebhook` |
| Reservas con TTL y cron de limpieza cada 5 min (el stock no queda secuestrado por checkouts abandonados) | `src/app/api/cron/clean-reservations` |
| Healthcheck con verificación de BD (`/api/health`) para monitoreo externo | `src/app/api/health/route.ts` |
| Sentry para captura de errores en runtime | `src/instrumentation.ts` |
| Fail-closed: env inválido no arranca; cron sin secreto responde 401 | `src/lib/env.ts`, `src/lib/auth/cron.ts` |

## 6. Seguridad

Tratada en profundidad en `docs/seguridad-owasp.md` (mapeo OWASP Top 10 control por control).
Resumen: Argon2id, AES-256-GCM para PII, JWT corto + refresh revocable, 2FA TOTP, RBAC en
dos capas, rate limiting, bloqueo de cuenta, headers (CSP/HSTS/XFO), webhooks firmados e
idempotentes, auditoría de acciones sensibles y bitácoras append-only con cadena de hash.

## 7. Mantenibilidad

| Mecanismo | Dónde |
|---|---|
| Arquitectura en capas: rutas/acciones (entrada) → servicios (lógica) → Prisma (datos). La UI nunca toca la BD directamente | `src/app` vs `src/lib/services` |
| Validación centralizada: un esquema Zod por contrato, compartido entre cliente y servidor | `src/lib/validation/schemas.ts` |
| TypeScript estricto + ESLint sin errores como gate de CI | `tsconfig.json`, `.github/workflows/ci.yml` |
| Sin duplicación en infraestructura transversal (auth de cron, RBAC, cookies, rate-limit son módulos únicos) | `src/lib/auth/**`, `src/lib/rate-limit.ts` |
| 33 tests unitarios sobre la lógica pura de negocio (totales, inventario, TOTP, PII, cadena de integridad, RBAC) | `tests/unit/**` |
| Comentarios que explican el *porqué* de cada decisión no obvia | en todo el código |

- **Métrica objetivo**: 0 errores de `tsc`, 0 errores de ESLint, suite verde en cada commit
  a `main` (lo impone CI).

## 8. Portabilidad

- 12-factor: toda la configuración por variables de entorno (`.env.example` documenta el
  contrato completo; `src/lib/env.ts` lo valida).
- Sin dependencias del filesystem local en runtime: apto para serverless (Vercel) o
  cualquier host Node ≥ 20.
- Postgres estándar vía Prisma: Neon, RDS o Postgres autogestionado sin cambios de código
  (solo `DATABASE_URL`/`DIRECT_URL`).

---

## Matriz de verificación

| Característica | Cómo se verifica | Frecuencia |
|---|---|---|
| Adecuación funcional | Checklist e2e (`deploy.md` §1.7) | Antes de cada release |
| Eficiencia | Lighthouse + revisión de consultas | Antes del go-live y ante regresiones |
| Fiabilidad | Tests unitarios + healthcheck + Sentry | CI / continuo |
| Seguridad | `pnpm audit` (CI) + audit semanal + revisión OWASP | CI / semanal / por release |
| Mantenibilidad | `tsc`, ESLint, tests en CI | Cada push |
| Portabilidad | Build reproducible en CI (entorno limpio) | Cada push |
