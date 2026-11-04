# 12. Operación: dónde corre y cómo se despliega

Las guías paso a paso están en [deploy.md](../deploy.md) (producción) y
[despliegue-local-docker.md](../despliegue-local-docker.md) (local). Aquí está el mapa.

## Dónde corre cada pieza

| Pieza | Dónde | Notas |
|---|---|---|
| Web, API y crons | **Vercel** (funciones serverless de Node) | El proyecto de Vercel está conectado al repositorio: cada push a `master` genera un despliegue |
| Base de datos | **Neon** (PostgreSQL serverless) | La app usa la conexión con pooler; las migraciones y el ML, la directa |
| Fotos | **Vercel Blob** | Nombres aleatorios, sin el nombre original |
| Correos | **Resend** | Opcional: sin la llave, los correos se omiten con un aviso |
| Límite de frecuencia compartido | **Upstash Redis** | Opcional: sin él, cada instancia cuenta en memoria |
| Entrenamiento ML | **GitHub Actions** | Diario, con el secret `NEON_DIRECT_URL` |
| App móvil | Expo (Expo Go en la demo) | Apunta a la URL pública de la API |

## Flujo de un cambio

```
push a master ─┬─► CI (ci.yml): tipos, lint, auditoría, unitarias, integración con Postgres, build
               ├─► E2E (e2e.yml): Docker de descarte + Playwright en navegador real
               └─► Vercel: build y despliegue a producción
```

**Regla de orden:** si un cambio necesita un esquema nuevo en la base, ese esquema se sube a
Neon **antes** del push del código, con aprobación explícita. Así el código nuevo nunca corre
contra tablas que todavía no existen. Para comprobar que Neon coincide con el código, sin tocar
nada:

```bash
corepack pnpm exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```

Si responde `-- This is an empty migration.`, están sincronizados.

## Workflows de GitHub Actions

| Workflow | Cuándo | Qué hace |
|---|---|---|
| [ci.yml](../../.github/workflows/ci.yml) | Cada push y PR a `master` | Instala con `--frozen-lockfile`, genera el cliente Prisma, `typecheck`, `lint`, `pnpm audit --audit-level=moderate`, pruebas unitarias, pruebas de integración contra un Postgres de servicio y `build` |
| [e2e.yml](../../.github/workflows/e2e.yml) | Cada push y PR a `master` | Levanta la tienda con `docker compose` (datos de descarte, sin Neon ni secretos) y corre Playwright |
| [ml-train.yml](../../.github/workflows/ml-train.yml) | Diario, 06:00 UTC, o a mano | Corre `python -m jobs.train_all` contra Neon |
| [deps-audit.yml](../../.github/workflows/deps-audit.yml) | Lunes, 09:00 UTC, o a mano | `pnpm audit` de bajo nivel en adelante. Si encuentra algo abre (o comenta) un issue, y lo cierra solo cuando se resuelve |

## Crons de Vercel

Están en [vercel.json](../../vercel.json): `clean-reservations` a las 03:00 UTC y
`clean-audit-logs` a las 04:00 UTC. Qué hace cada uno está en [07-backend.md](07-backend.md).

## Variables de entorno

Se validan al arrancar con [env.ts](../../src/lib/env.ts). Las obligatorias:

| Grupo | Variables |
|---|---|
| Base de datos | `DATABASE_URL` (pooler), `DIRECT_URL` (directa) |
| Secretos propios | `JWT_SECRET` (≥ 32 caracteres), `DATA_ENCRYPTION_KEY` (64 hex), `CRON_SECRET` (≥ 16) y `SESSION_SECRET` (≥ 32). Esta última la exige `env.ts`, pero hoy ningún módulo la usa: las sesiones se cifran con `JWT_SECRET` |
| Pagos | `TBK_ENV` (`integration` / `production`), `TBK_COMMERCE_CODE`, `TBK_API_KEY`, `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY` |
| Sitio | `NEXT_PUBLIC_APP_URL` |

Las opcionales son `MP_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
`RESERVATION_TTL_MINUTES` (15 por defecto), `LOW_STOCK_DEFAULT` y las de Upstash. La plantilla
sin valores está en `.env.example`. **`.env` nunca se versiona.**

## Docker local

[docker-compose.yml](../../docker-compose.yml) levanta dos contenedores:

- `db`: Postgres 16, **sin puertos expuestos**, visible solo dentro de la red de compose.
- `app`: la tienda, en `127.0.0.1:3000`, es decir, solo desde el propio equipo.

[docker-entrypoint.sh](../../docker-entrypoint.sh) prepara todo al arrancar:

1. Aplica el esquema (`prisma db push`).
2. Carga los datos base: categorías, productos y los usuarios de prueba.
3. Si faltan (o quedaron con fechas viejas), genera unos 24 meses de datos sintéticos de
   operación, seguridad y analítica.
4. Inicia Next en modo desarrollo.

La imagen copia el código al construirse, así que **después de cambiar el código hay que
reconstruirla**:

```bash
docker compose up -d --build
```

Las credenciales del seed (`vendedor@hachiko.local`, `cliente@hachiko.local`) son de descarte y
no existen en producción.

## Versiones de herramientas

- Node 20 o superior.
- pnpm 9.15 (fijado en `packageManager`). En equipos donde `pnpm` no está en el PATH, se usa
  `corepack pnpm`.
- Python 3.12 en el pipeline de ML.
- La app móvil usa npm, con `overrides` en su `package.json`.
- Las versiones vulnerables de dependencias transitivas se corrigen con `overrides` en
  `package.json` y en `pnpm-workspace.yaml`, con un comentario que explica cada uno.
