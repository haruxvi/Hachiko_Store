# Ciclo de vida del software — ISO/IEC 12207

Definición de los procesos del ciclo de vida aplicados a Hachiko, mapeados a los artefactos
reales del repositorio. El objetivo es que el resultado **no dependa del programador de
turno**: cualquier persona que tome el proyecto encuentra el mismo proceso documentado y
ejecutable.

## 1. Procesos técnicos

### 1.1 Análisis de requisitos

- Requisitos funcionales: storefront (catálogo, carrito, checkout), pagos chilenos (Webpay
  Plus + Mercado Pago), trastienda (productos, categorías, inventario trazable, despacho),
  cuenta del cliente (perfil, pedidos, ARCO) y módulo de incidencias de ciberseguridad.
- Requisitos no funcionales: ver `docs/calidad-iso25010.md` (producto) y
  `docs/seguridad-owasp.md` (seguridad).
- Requisitos legales que condicionan el diseño: Ley 21.719 (datos personales), Ley 21.459
  (delitos informáticos), Ley 21.663 (ciberseguridad) — trazados en el schema y en los docs.

### 1.2 Diseño de arquitectura

Arquitectura en capas dentro de un monolito Next.js (App Router):

```
Cliente (RSC + componentes 'use client')
   │
   ├── Server Actions (src/actions/*)        ─┐  capa de entrada:
   ├── Route Handlers (src/app/api/**)       ─┤  auth + validación Zod + rate limit
   │                                          ┘
   ├── Servicios (src/lib/services/*)        →  toda la lógica de negocio
   ├── Infraestructura (src/lib/{auth,crypto,payments,validation})
   └── Prisma (src/lib/db.ts) → PostgreSQL (Neon)
```

Reglas de diseño (verificables en revisión de código):

1. La UI nunca importa `db` directamente; siempre pasa por un servicio.
2. Toda entrada externa se valida con Zod **en el servidor**, aunque la UI ya valide.
3. La autorización se verifica en la capa de entrada (`requireRole`/`getSession`), nunca se
   asume desde el middleware.
4. El descifrado de PII ocurre solo en servicios, para el rol que lo necesita.

### 1.3 Construcción

- TypeScript estricto, ESLint (`.eslintrc.json`), Prettier; hooks de pre-commit con husky +
  lint-staged.
- Convenciones: servicios `*.service.ts`, esquemas en `validation/schemas.ts`, componentes
  por dominio (`storefront/`, `panel/`).
- Criterio "logs limpios": **cero errores y cero warnings** en `tsc` y ESLint para poder
  integrar (lo impone CI).

### 1.4 Pruebas (verificación y validación)

| Nivel | Qué cubre | Herramienta |
|---|---|---|
| Unitario | Lógica pura: totales/envío, inventario, TOTP, cifrado PII, cadena de integridad, RBAC | Vitest (`tests/unit/**`) |
| Integración manual | Flujos completos con pasarelas en ambiente de integración | `docs/guia-de-pruebas.md` |
| E2E (preparado) | Flujos de navegador | Playwright (`pnpm test:e2e`) |
| Aceptación | Checklist end-to-end en despliegue de prueba | `docs/deploy.md` §1.7 |

### 1.5 Despliegue

Proceso completo en `docs/deploy.md`: fase de prueba con credenciales propias y fase de
entrega con rotación total de secretos. Infra: Vercel (app + crons) y Neon (Postgres).
Migraciones con `prisma migrate deploy` (nunca `db push` en producción).

### 1.6 Operación y mantenimiento

- Monitoreo: `/api/health` (uptime), Sentry (errores), KPIs de seguridad en la trastienda.
- Mantenimiento correctivo: bugs → issue → branch → PR → CI verde → merge.
- Mantenimiento preventivo: audit semanal de dependencias con SLA de parcheo
  (`docs/seguridad-owasp.md`).
- Datos: crons de limpieza de reservas y anonimización de auditoría (`vercel.json`).

## 2. Procesos de apoyo

| Proceso ISO 12207 | Implementación |
|---|---|
| Gestión de configuración | Git + GitHub; lockfile congelado en CI; migraciones versionadas en `prisma/migrations` |
| Aseguramiento de calidad | `docs/plan-sqa-ieee730.md` |
| Verificación | CI: typecheck + lint + audit + tests + build en cada push/PR |
| Documentación | `docs/**` + OpenAPI (`pnpm docs:api`) + comentarios de *porqué* en código |
| Resolución de problemas | Issues de GitHub; vulnerabilidades propias → módulo de incidencias |

## 3. Flujo de cambio (de la idea a producción)

```
requisito/bug → issue → rama → desarrollo (con esquema Zod y servicio primero)
   → tests unitarios de la lógica nueva → actualizar OpenAPI si cambia la API
   → PR → CI (tsc + eslint + audit + vitest + build) → revisión → merge a main
   → deploy automático (Vercel) → checklist de humo si el cambio toca pagos/auth
```

**Definition of Done** (estricta, sin excepciones):

- [ ] `pnpm typecheck`, `pnpm lint` y `pnpm test` en verde, sin warnings nuevos.
- [ ] Entrada validada con Zod y autorización verificada en la capa de entrada.
- [ ] Si cambia la API: `src/lib/docs/openapi.ts` actualizado + `pnpm docs:api`.
- [ ] Si toca datos personales o dinero: acción auditada con `writeAudit`.
- [ ] Si cambia el esquema: migración Prisma incluida en el mismo PR.
- [ ] Documentación afectada (`docs/**`) actualizada en el mismo PR.
