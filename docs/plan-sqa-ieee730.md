# Plan de Aseguramiento de Calidad del Software (SQA) — IEEE 730

Plan SQA de Hachiko, estructurado según IEEE 730. Define qué se controla, con qué
herramientas, quién es responsable y qué pasa cuando algo falla.

## 1. Propósito y alcance

Asegurar que todo lo que llega a `main` (y por lo tanto a producción) cumple los estándares
de producto (`docs/calidad-iso25010.md`), de datos (`docs/calidad-datos-iso25012.md`) y de
seguridad (`docs/seguridad-owasp.md`). Aplica a todo el código de `src/`, el esquema de
datos (`prisma/`), la configuración (`next.config.ts`, `vercel.json`, workflows) y la
documentación (`docs/`).

## 2. Documentos de referencia

| Documento | Rol |
|---|---|
| `docs/calidad-iso25010.md` | Estándar de calidad de producto |
| `docs/calidad-datos-iso25012.md` | Estándar de calidad de datos |
| `docs/seguridad-owasp.md` | Estándar de seguridad + gestión CVE/NVD |
| `docs/ciclo-de-vida-iso12207.md` | Procesos del ciclo de vida y Definition of Done |
| `docs/api/openapi.json` | Contrato de la API |
| `docs/deploy.md`, `docs/guia-de-pruebas.md` | Despliegue y validación |

## 3. Estándares, prácticas y convenciones

- **Código**: TypeScript estricto; ESLint + Prettier; comentarios explican *porqués*, no
  *qués*; español en mensajes de usuario, inglés permitido en identificadores.
- **Arquitectura**: capas entrada → servicio → datos (reglas en
  `docs/ciclo-de-vida-iso12207.md` §1.2).
- **API**: errores siempre `{ ok: false, error: { code, message } }`; todo cambio de
  contrato se refleja en `src/lib/docs/openapi.ts` en el mismo commit.
- **Datos**: reglas operativas de `docs/calidad-datos-iso25012.md` (Zod + servicio, stock
  solo vía inventory.service, bitácoras append-only, migraciones versionadas).
- **Secretos**: jamás en el código ni en git; contrato en `.env.example`, validación en
  `src/lib/env.ts`.

## 4. Revisiones y auditorías

| Revisión | Cuándo | Criterio de salida |
|---|---|---|
| Revisión de PR | Todo cambio a `main` | CI verde + revisión de pares contra la DoD |
| Revisión de seguridad | Cambios en auth, pagos, crypto o manejo de PII | Verificar contra `docs/seguridad-owasp.md` |
| Auditoría de dependencias | Cada push (moderate) + semanal (low) | Sin CVE sobre umbral; SLA de parcheo si aparece |
| Auditoría pre-release | Antes de cada go-live | Checklist `docs/deploy.md` §1.7 completo |

## 5. Verificación automatizada (gates de CI)

Pipeline en `.github/workflows/ci.yml` — **todos los pasos son bloqueantes**:

1. `pnpm install --frozen-lockfile` — reproducibilidad.
2. `pnpm typecheck` — 0 errores de tipos.
3. `pnpm lint` — 0 errores de ESLint.
4. `pnpm audit --audit-level=moderate` — sin CVE moderadas+.
5. `pnpm test` — suite unitaria completa en verde (33 tests).
6. `pnpm build` — la app compila en entorno limpio.

Complementos: pre-commit con husky/lint-staged (feedback inmediato) y
`deps-audit.yml` semanal con apertura automática de issue.

## 6. Pruebas

- **Unitarias** (Vitest): toda lógica de negocio pura nueva debe llegar con tests. Áreas
  cubiertas hoy: totales y envío, inventario, TOTP, cifrado PII, cadena de integridad, RBAC.
- **Integración** (manual, guiada): `docs/guia-de-pruebas.md` con pasarelas en ambiente de
  integración.
- **E2E** (Playwright): reservado para los flujos críticos (compra completa, login con 2FA)
  antes del go-live.
- Regla de regresión: todo bug corregido en lógica de negocio deja un test que lo habría
  detectado.

## 7. Reporte y resolución de problemas

- **Defectos**: issue en GitHub con pasos de reproducción → prioridad según impacto →
  corrección vía PR con test de regresión.
- **Vulnerabilidades de dependencias**: flujo y SLA en `docs/seguridad-owasp.md`.
- **Incidentes de seguridad en producción**: se registran en el módulo de incidencias
  (`/trastienda/seguridad`) con bitácora encadenada; el informe exportado es el respaldo
  para la notificación a la autoridad cuando aplica.
- **Errores en runtime**: Sentry notifica; se triagean igual que defectos.

## 8. Herramientas y metodología

| Herramienta | Función SQA |
|---|---|
| TypeScript / ESLint / Prettier | Análisis estático y estilo |
| Vitest / Playwright | Pruebas |
| pnpm audit + GitHub Actions | Seguridad de la cadena de suministro |
| Prisma migrate | Control de cambios del esquema |
| Sentry | Detección de fallas en operación |
| Swagger UI / OpenAPI | Contrato de API verificable |

## 9. Métricas de calidad

| Métrica | Objetivo | Fuente |
|---|---|---|
| Errores de tipo / lint en `main` | 0 | CI |
| Tests unitarios | 100 % en verde; lógica nueva siempre con tests | CI |
| CVE abiertas sobre SLA | 0 | deps-audit + issues |
| Tiempo de corrección CVE crítica | ≤ 24 h | issues |
| Lighthouse Performance (home/catálogo) | ≥ 90 | pre-release |
| Checklist e2e pre-release | 100 % | `deploy.md` §1.7 |

## 10. Registros

Los registros de calidad quedan en: historial de CI (GitHub Actions), issues/PRs, informes
de incidencia exportados (JSON firmado por cadena de hash) y `AuditLog` en la base de datos.
