# Hachiko 🐕

E-commerce de productos coreanos (snacks, skincare, papelería, merch K-pop) con despacho a
todo Chile. Next.js 15 (App Router) + Prisma/PostgreSQL, pagos con **Webpay Plus** y
**Mercado Pago**, y cumplimiento de las leyes chilenas 21.719 (datos personales), 21.459
(delitos informáticos) y 21.663 (ciberseguridad).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend / Backend | Next.js 15, React 19, TypeScript estricto, Tailwind CSS |
| Datos | PostgreSQL (Neon) vía Prisma; PII cifrada AES-256-GCM |
| Auth | JWT (jose) en cookies httpOnly + Argon2id + 2FA TOTP |
| Pagos | transbank-sdk (Webpay Plus), mercadopago (Checkout Pro) |
| Email | Resend |
| Observabilidad | Sentry, `/api/health` |
| Calidad | Vitest, Playwright, ESLint, CI en GitHub Actions |

## Desarrollo

```bash
pnpm install
cp .env.example .env   # completar — ver docs/deploy.md
pnpm db:migrate && pnpm db:seed
pnpm dev               # http://localhost:3000
```

Comandos de calidad (los mismos que bloquean el CI):

```bash
pnpm typecheck   # 0 errores de tipos
pnpm lint        # 0 errores de ESLint
pnpm test        # suite unitaria (Vitest)
pnpm audit       # CVE moderadas o superiores
pnpm docs:api    # regenera docs/api/openapi.json
```

## Documentación

### Producto y API

| Documento | Contenido |
|---|---|
| [docs/api.md](docs/api.md) | Referencia de la API + cómo usar **Swagger UI** (`/api/docs` en dev) |
| [docs/api/openapi.json](docs/api/openapi.json) | Contrato OpenAPI 3.1 (generado de `src/lib/docs/openapi.ts`) |

### Calidad y procesos

| Documento | Norma |
|---|---|
| [docs/calidad-iso25010.md](docs/calidad-iso25010.md) | Calidad de producto — ISO/IEC 25010 (ISO 25000/SQuaRE) |
| [docs/calidad-datos-iso25012.md](docs/calidad-datos-iso25012.md) | Calidad de datos — ISO/IEC 25012 |
| [docs/ciclo-de-vida-iso12207.md](docs/ciclo-de-vida-iso12207.md) | Ciclo de vida y Definition of Done — ISO/IEC 12207 |
| [docs/plan-sqa-ieee730.md](docs/plan-sqa-ieee730.md) | Plan de aseguramiento de calidad — IEEE 730 |
| [docs/procesos-cmmi.md](docs/procesos-cmmi.md) | Madurez de procesos — CMMI-DEV |

### Seguridad

| Documento | Contenido |
|---|---|
| [docs/seguridad-owasp.md](docs/seguridad-owasp.md) | Mapeo **OWASP Top 10** → controles del código + gestión de vulnerabilidades CVE/NVD con SLA |

### Operación

| Documento | Contenido |
|---|---|
| [docs/deploy.md](docs/deploy.md) | Despliegue (Vercel + Neon) y entrega al cliente con rotación de secretos |
| [docs/guia-de-pruebas.md](docs/guia-de-pruebas.md) | Guía de pruebas de integración |

## Estructura

```
src/
├── app/            # rutas: (storefront), (account), (panel)/trastienda, api/
├── actions/        # Server Actions (mutaciones del panel y la cuenta)
├── components/     # UI por dominio (storefront/, panel/)
└── lib/
    ├── services/   # toda la lógica de negocio
    ├── auth/       # jwt, sesión, rbac, totp, cron
    ├── crypto/     # cifrado PII, cadena de integridad
    ├── payments/   # webpay, mercadopago
    ├── validation/ # esquemas Zod (única definición de reglas)
    └── docs/       # especificación OpenAPI
prisma/             # schema, migraciones, seed
tests/unit/         # Vitest
docs/               # toda la documentación de arriba
```

Regla de oro de la arquitectura: **entrada (route/action) → servicio → Prisma**. La UI
nunca toca la base de datos, toda entrada se valida con Zod en el servidor y toda acción
sensible queda auditada.
