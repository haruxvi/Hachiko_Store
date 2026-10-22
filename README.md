<div align="center">

# 🐕 Hachiko Store

**Plataforma de comercio electrónico adaptable para PyMEs, con arquitectura en dos planos,
seguridad integrada desde el diseño y KPIs resueltos con machine learning.**

Validada sobre un caso real: una PyME chilena que importa snacks, skincare, papelería y merch K-pop.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Expo](https://img.shields.io/badge/App-Expo%20%2F%20React%20Native-000020?logo=expo)](mobile/README.md)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Python](https://img.shields.io/badge/Python-scikit--learn-3776AB?logo=python&logoColor=white)](ml/README.md)
[![OWASP](https://img.shields.io/badge/OWASP-Top%2010%20mapeado-000000)](docs/seguridad-owasp.md)
[![License](https://img.shields.io/badge/license-Proprietary-lightgrey)](#-licencia)

[Demo](https://hachiko-store.vercel.app) · [Arquitectura](#-arquitectura) · [Seguridad](#-seguridad-integrada-desde-el-diseño) · [Inteligencia](#-kpis-resueltos-con-machine-learning) · [Documentación](#-documentación)

</div>

---

## Por qué no es un e-commerce más

El catálogo de productos coreanos es el caso de uso. Lo que este proyecto construye, y lo que
se puede llevar a otra PyME cambiando catálogo y configuración, son tres capas que una tienda
genérica no trae:

| Pilar | Qué resuelve | Cómo se demuestra |
|---|---|---|
| **Arquitectura adaptable** | Crecer y cambiar sin rehacer el sistema | Capas (entrada → servicio → datos) y dos planos: operacional y analítico. Web, PWA y app móvil sobre el mismo backend |
| **Seguridad integrada** | Cumplir la ley y resistir ataques desde el día uno | OWASP Top 10 mapeado control por control al archivo donde vive; pentest local 34/34; bitácora encadenada por hash |
| **KPIs con ML** | Decidir con datos, no por intuición | 10 vistas de inteligencia y 7 modelos (forecast, reposición, segmentación, recomendación, fraude), con trazabilidad por corrida |

### En números

| | |
|---|---|
| **210 tests automatizados** | 157 unitarios (20 archivos) + 53 de integración contra Postgres real (4 archivos) |
| **34/34 verificaciones de pentest** | Autenticación, IDOR, pagos, inyección, rate limit y DoS, en entorno aislado ([informe](docs/pentest-local-2026-10.md)) |
| **10 vistas de inteligencia** | Métricas, Demanda, Qué reponer, Logística, Recomendaciones, Clientes, Conversión, Riesgo, Modelos y Reporte |
| **3 interfaces, 1 backend** | Web, PWA instalable y app Expo, todas por la misma API, la misma base y las mismas reglas |
| **5 marcos legales** | Leyes 21.719, 21.459, 21.663, 19.496 y obligaciones SII |

---

## 🏗️ Arquitectura

```
                    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                    │  Web (Next)  │  │  PWA         │  │  App Expo    │
                    └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                           │                 │                 │ /api/v1
                           ▼                 ▼                 ▼
          ┌────────────────────────────────────────────────────────────────┐
          │  ENTRADA   route handlers · Server Actions · middleware (RBAC)  │
          │            validación Zod en todo input                          │
          ├────────────────────────────────────────────────────────────────┤
          │  SERVICIO  src/lib/services — toda la lógica de negocio          │
          │            pedidos · inventario · pagos · auditoría · seguridad  │
          ├────────────────────────────────────────────────────────────────┤
          │  DATOS     Prisma → PostgreSQL (Neon)                            │
          └───────────────┬───────────────────────────────▲────────────────┘
                          │ lee crudo                     │ lee predicciones
                          ▼                               │
          ┌───────────────────────────────────────────────┴────────────────┐
          │  PLANO ANALÍTICO   /ml — Python, pandas, scikit-learn            │
          │  entrena por lotes en GitHub Actions (cron), nunca en Vercel     │
          │  escribe tablas derivadas + ModelRun (versión y métricas)        │
          └────────────────────────────────────────────────────────────────┘
```

**Reglas que sostienen la adaptabilidad:**

- **La UI nunca toca la base de datos.** Toda operación pasa por un servicio, así que cambiar
  una pantalla no arriesga la lógica, y una interfaz nueva (como la app) reutiliza todo.
- **Prisma es el único dueño del esquema.** Python solo lee lo operacional y escribe sus tablas
  derivadas: reentrenar modelos no exige migraciones ni toca las entidades núcleo.
- **Estado + bitácora.** El estado actual vive en la entidad (`Product.stock`); la historia, en
  tablas append-only aparte (`StockMovement`, `PriceHistory`, `OrderStatusHistory`, `AuditLog`).
- **Configuración por variables de entorno**, validadas con Zod al arrancar: una configuración
  inválida no levanta la app.

---

## 🔒 Seguridad integrada desde el diseño

La seguridad no se agregó al final: cada control está en la arquitectura y apunta al archivo
donde vive en [`docs/seguridad-owasp.md`](docs/seguridad-owasp.md).

### Autenticación y sesiones
- **Argon2id** (memory-hard) para contraseñas.
- **JWT de acceso corto** (15 min) + **refresh rotativo de un solo uso** en cookie
  `httpOnly`/`secure`/`sameSite:strict`. Si reaparece un refresh ya usado, se revoca toda la
  sesión y queda en el `AuditLog` (`REFRESH_TOKEN_REUSE`).
- **Bloqueo de cuenta** tras 5 fallos, con contador atómico; invalidación global por `tokenVersion`.
- **Recuperación de contraseña** con token de un solo uso y respuesta idéntica exista o no el correo.

### Doble factor (TOTP, RFC 6238)
- Compatible con Google/Microsoft Authenticator y Authy, sin SMS.
- Secreto cifrado con AES-256-GCM y QR generado en el servidor.
- Se pide solo tras validar la contraseña, cada código sirve una vez y desactivarlo exige un código vigente.

### Control de acceso
- Dos roles: `CLIENT` y `SELLER`. **No existe superusuario.**
- Rol verificado en el middleware y de nuevo en cada handler y Server Action (`requireRole()`).
- Las órdenes solo son visibles para su dueño (sin IDOR). El vendedor ve datos mínimos de
  despacho, nunca la PII completa (Ley 21.719).

### Datos y superficie de ataque
- **PII cifrada en reposo** con AES-256-GCM (IV aleatorio por valor).
- HSTS, headers de seguridad y **CSP con nonce por request**.
- Validación Zod en todo input, rate limiting por IP y usuario, consultas parametrizadas vía Prisma.

### Pagos
- Confirmación **servidor a servidor** con Transbank y Mercado Pago; nunca se confía en el redirect.
- Webhooks con **firma verificada e idempotencia**: un evento duplicado no descuenta stock dos veces.
- **Reembolsos trazables**: un pago que no se puede cumplir queda `REFUND_PENDING` con alerta
  crítica, se devuelve desde la trastienda con bloqueo contra doble devolución y queda auditado.
- Cero almacenamiento de datos de tarjeta, también en la app móvil.

### Auditoría y respuesta a incidentes
- **AuditLog append-only** para acciones sensibles.
- Módulo `/trastienda/seguridad`: incidencias tipificadas según la Ley 21.459, flujo de
  notificación a la autoridad (Leyes 21.663 y 21.719) y **bitácora encadenada por hash SHA-256**
  (`verifyChain`): alterar o borrar un registro rompe la cadena.
- Las IP de incidencias se anonimizan y eliminan automáticamente al vencer su plazo
  ([política de retención](docs/retencion-anonimizacion-datos.md)).

### Cadena de suministro
- pnpm con `ignore-scripts`, lockfile congelado en CI y versiones exactas en auth, cripto y pagos.
- `pnpm audit` bloqueante en cada push y auditoría semanal que abre un issue si encuentra algo.
- SLA de remediación de CVE: crítica 24 h · alta 72 h · media 2 semanas.

### Verificado con pentest
En octubre de 2026 se ejecutaron 34 verificaciones y pruebas destructivas contra un build de
producción local. Se encontraron 4 hallazgos (1 de enumeración y 3 de disponibilidad), todos
corregidos y verificados: la batería pasa **34/34**. Detalle en
[`docs/pentest-local-2026-10.md`](docs/pentest-local-2026-10.md).

> ¿Encontraste una vulnerabilidad? No abras un issue público: escribe directamente al equipo.

---

## 🧠 KPIs resueltos con machine learning

El subsistema convierte la operación diaria en respuestas para el dueño del negocio. Sigue la
metodología **CRISP-DM** y está documentado en [`docs/machine-learning.md`](docs/machine-learning.md).

| Pregunta del negocio | Modelo | Técnica | Métrica |
|---|---|---|---|
| ¿Cuánto voy a vender? | Forecast de demanda | Regresión Ridge con estacionalidad | MAE + bandas de incertidumbre |
| ¿Qué compro y cuándo? | Reposición | Forecast + lead time + stock | Días a quiebre, cantidad sugerida |
| ¿A quién le hablo? | Segmentación | RFM + KMeans | Silhouette |
| ¿Qué se vende junto? | Recomendador | Reglas de asociación | Soporte, confianza, lift |
| ¿Qué pedido es sospechoso? | Fraude en órdenes | Isolation Forest | Score 0–1 + señales explicables |
| ¿Me están atacando? | Account takeover | Reglas sobre `AuditLog` | Fuerza bruta y credential stuffing |
| ¿Cómo va el negocio? | KPIs / BI | Agregaciones | Ingresos, margen, ABC, ventas por comuna |

**Principios del subsistema:**

- **El modelo sugiere, la decisión es humana.** Ninguna predicción tiene efecto jurídico automático.
- **Trazabilidad:** toda predicción referencia el `ModelRun` que la generó (versión, estado y métricas).
- **Privacidad:** el perfilado opera solo con consentimiento (`consentMarketing`), el pipeline
  entrena sobre datos pseudonimizados y la medición del embudo es opt-in.
- **Datos honestos:** una tienda nueva no tiene historia, así que el desarrollo usa un dataset
  sintético de ~24 meses y ~9.000 pedidos, marcado como tal (`@seed.hachiko.test`, SKU `SYN-`)
  y borrable. Nunca se mezcla con datos reales.

Aquí la IA y la seguridad se refuerzan: los modelos de fraude y account takeover se entrenan
sobre los registros que genera la propia capa de seguridad.

---

## 📦 Inventario sin sobreventa

El stock no se descuenta al agregar al carrito (bloquearía unidades) ni al despachar (permitiría
vender la misma unidad dos veces). Se usa un **patrón de reserva con TTL**:

```
1. Checkout   → transacción atómica: verifica disponibilidad y reserva por 15 minutos
2. Pago OK    → descuenta stock, elimina la reserva y registra el movimiento (todo o nada)
3. Expira     → un cron libera la reserva y el stock vuelve a estar disponible
```

Las operaciones corren con aislamiento **`Serializable`** y reintento con backoff. Si dos
clientes compran la última unidad a la vez, uno gana y el otro recibe un error claro.
Si el dinero llega pero el pedido ya no se puede cumplir, pasa a `CANCELLED` con pago
`REFUND_PENDING`; nunca queda pagado a medias.

Cubierto por [tests de integración contra Postgres real](tests/integration/checkout-flow.test.ts):
cinco compras paralelas sobre una unidad, pagos tardíos simultáneos, webhooks duplicados,
cancelación y pago al mismo tiempo, y monto distinto.

| Concepto | Definición |
|---|---|
| **Físico** | Unidades reales en bodega |
| **Reservado** | Unidades apartadas en órdenes pendientes de pago |
| **Disponible** | Físico − Reservado: lo que de verdad puede comprar un cliente |

---

## ✨ Funcionalidades

**Tienda (cliente)**
- Catálogo por categorías con búsqueda y filtros; ficha con «se compran juntos».
- Carrito persistente y checkout en una página con Webpay Plus o Mercado Pago.
- Seguimiento de pedidos y retiro en tienda.
- Cuenta con 2FA y derechos ARCOP (acceso, rectificación, cancelación, oposición, portabilidad).

**Trastienda (vendedor)**
- Dashboard «Hoy», órdenes por despachar con flujo *Para empacar → Preparando → Enviado /
  Listo para retiro → Entregado*, devoluciones y promociones.
- CRUD de productos con **edición de precio auditada** y **carga masiva por CSV/XLSX**
  con vista previa, reposición por SKU y plantilla ([guía](docs/carga-masiva.md)).
- Inventario con ajuste manual de stock (motivo obligatorio, ledger inmutable).
- Grupo «Inteligencia» con las 10 vistas y módulo de Seguridad.

**App móvil (Expo / React Native)** — [detalles](mobile/README.md)
- Clientes: vitrina, búsqueda, carrito, pago en el navegador seguro del sistema y mis pedidos.
- Vendedor: pedidos por despachar, inventario, escáner de códigos.
- El refresh token vive en el llavero cifrado del teléfono; la app nunca maneja datos de tarjeta.

**PWA instalable** desde [hachiko-store.vercel.app](https://hachiko-store.vercel.app), con
accesos directos y página sin conexión. El service worker solo guarda archivos públicos,
**nunca páginas ni respuestas de la API** (cubierto por [tests](tests/unit/pwa.test.ts)).

---

## 🧰 Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, RSC, Server Actions) |
| Lenguaje | TypeScript (`strict: true`) |
| UI | React 19 + TailwindCSS (sistema de diseño propio «Shiba pastel») |
| App móvil | Expo / React Native + TanStack Query + Zustand |
| Formularios | React Hook Form + Zod |
| Datos | Prisma 6 + PostgreSQL (Neon) |
| Auth | jose (JWT) + Argon2id + iron-session + TOTP |
| Pagos | transbank-sdk (Webpay Plus) + mercadopago |
| Email | Resend |
| ML | Python, pandas, NumPy, scikit-learn, SQLAlchemy ([dependencias fijadas](ml/requirements.txt)) |
| CI / ML programado | GitHub Actions |
| Despliegue | Vercel · Docker para entorno local y demo |

---

## 🚀 Puesta en marcha

### Requisitos
- Node.js 20 LTS y pnpm 9
- Python 3.12+ (solo para el pipeline de ML)
- PostgreSQL: [Neon](https://neon.tech/) o Docker local ([guía](docs/despliegue-local-docker.md))
- Cuentas sandbox de Transbank y Mercado Pago

### App web

```bash
git clone https://github.com/haruxvi/Hachiko_Store.git
cd Hachiko_Store
pnpm install                 # scripts deshabilitados por seguridad (.npmrc)
cp .env.example .env         # completar credenciales
pnpm exec prisma db push     # sincroniza el esquema (el repo no versiona migraciones)
pnpm dev                     # http://localhost:3000
```

### Datos de demostración

El orden importa: `synthetic` va primero.

```bash
pnpm db:seed:synthetic   # ~24 meses, catálogo, clientes y ~9.000 pedidos
pnpm db:seed:security    # logins fallidos + incidentes (vista Riesgo)
pnpm db:seed:analytics   # navegación y carrito (vista Conversión)
```

### Pipeline de ML

```bash
cd ml
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt   # Windows (Linux/macOS: .venv/bin/...)
.venv\Scripts\python -m jobs.train_all           # entrena todos los modelos
```

Toma `DIRECT_URL` del `.env` de la raíz. En la nube corre solo por cron en
[`ml-train.yml`](.github/workflows/ml-train.yml), con el secret `NEON_DIRECT_URL`.

### Demo en un teléfono (equipo y comisión)

Un comando levanta un entorno Docker aislado con datos de prueba (**nunca toca Neon**) y abre la
app lista para escanear con Expo Go. El teléfono y el computador deben estar en el mismo Wi-Fi.

```bash
node scripts/demo-lan.mjs
```

| Rol | Correo | Contraseña |
|---|---|---|
| Vendedor | `vendedor@hachiko.local` | `Vendedor.Local2026` |
| Cliente | `cliente@hachiko.local` | `Cliente.Local2026` |

> ⚠️ Estas cuentas existen solo en el Docker local. Úsalo en una red de confianza: mientras está
> activo, cualquiera en el mismo Wi-Fi puede abrir el sitio con ellas. Si la red aísla dispositivos
> (universidad, café), usa el hotspot del teléfono. Opciones: `--ip=…`, `--no-expo`, `--keep`, `--dry-run`.

### Variables de entorno

Documentadas en [`.env.example`](.env.example). Imprescindibles: `DATABASE_URL`, `DIRECT_URL`,
`JWT_SECRET`, `SESSION_SECRET`, `DATA_ENCRYPTION_KEY`, `TBK_ENV`, `MP_ACCESS_TOKEN`,
`RESEND_API_KEY` y `CRON_SECRET`. **Nunca** commitees `.env`.

---

## ✅ Calidad y pruebas

Los mismos comandos que bloquean el CI en cada push:

```bash
pnpm typecheck          # 0 errores de tipos
pnpm lint               # 0 errores de ESLint
pnpm test               # 157 tests unitarios (Vitest)
pnpm audit              # CVE moderadas o superiores
pnpm build              # build de producción
```

**Tests de integración** contra un Postgres real y desechable (las transacciones `Serializable`
no se pueden probar con mocks). Abortan si la base no es local, así que nunca tocan Neon:

```bash
docker run -d --name hachiko-test-db -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=hachiko_test -p 127.0.0.1:55432:5432 postgres:16-alpine
# PowerShell:
$env:DATABASE_URL="postgresql://test:test@127.0.0.1:55432/hachiko_test"; $env:DIRECT_URL=$env:DATABASE_URL
pnpm exec prisma db push --skip-generate
pnpm test:integration   # 53 tests: checkout, reembolsos, retiro/devoluciones, seguridad y analítica
docker rm -f hachiko-test-db
```

---

## 📚 Documentación

| Área | Documento |
|---|---|
| **Seguridad** | [OWASP Top 10 → código](docs/seguridad-owasp.md) · [Pentest local](docs/pentest-local-2026-10.md) · [Retención y anonimización](docs/retencion-anonimizacion-datos.md) |
| **Inteligencia** | [Machine learning (CRISP-DM)](docs/machine-learning.md) · [Pipeline `/ml`](ml/README.md) |
| **Calidad** | [ISO/IEC 25010](docs/calidad-iso25010.md) · [ISO/IEC 25012](docs/calidad-datos-iso25012.md) · [ISO/IEC 12207](docs/ciclo-de-vida-iso12207.md) · [IEEE 730](docs/plan-sqa-ieee730.md) · [CMMI](docs/procesos-cmmi.md) |
| **API** | [Referencia](docs/api.md) · [OpenAPI 3.1](docs/api/openapi.json) (Swagger UI en `/api/docs`, solo desarrollo) |
| **Operación** | [Despliegue](docs/deploy.md) · [Docker local](docs/despliegue-local-docker.md) · [Carga masiva](docs/carga-masiva.md) · [Guía de pruebas](docs/guia-de-pruebas.md) |
| **App móvil** | [mobile/README.md](mobile/README.md) |
| **Capstone** | Evidencias académicas en [`Capstone/`](Capstone/) |

---

## 🗂️ Estructura

```
src/
├── app/
│   ├── (storefront)/   tienda pública
│   ├── (account)/      cuenta del cliente y derechos ARCOP
│   ├── (panel)/        trastienda: operación + Inteligencia + Seguridad
│   └── api/            auth, pagos, webhooks, cron y /api/v1 (app móvil)
├── lib/
│   ├── services/       toda la lógica de negocio
│   ├── auth/  crypto/  payments/  validation/
├── actions/            Server Actions
└── middleware.ts       auth + RBAC
mobile/                 app Expo / React Native
ml/                     pipeline Python (jobs/ + trazabilidad ModelRun)
prisma/                 esquema y seeds (base, sintético, seguridad, analítica)
tests/                  unit/ e integration/
docs/                   documentación viva
```

---

## ⚖️ Cumplimiento legal (Chile)

- **Ley 21.719** — datos personales: consentimiento granular, ARCOP, minimización, perfilado con consentimiento.
- **Ley 21.459** — delitos informáticos: tipificación de incidencias.
- **Ley 21.663** — marco de ciberseguridad: notificación de incidentes.
- **Ley 19.496** — protección al consumidor: retracto, precios con IVA, devoluciones.
- **SII** — obligaciones tributarias del comercio electrónico.

---

## 🗺️ Roadmap

**Hecho**
- [x] Autenticación, RBAC, 2FA TOTP y recuperación de contraseña
- [x] Catálogo, carrito, checkout y pagos (Webpay Plus, Mercado Pago) con reembolsos trazables
- [x] Inventario con reservas TTL, ledger de stock e historial de precios
- [x] Subsistema de inteligencia: 10 vistas y 7 modelos con pipeline programado
- [x] Detección de fraude y account takeover con ML
- [x] Módulo de seguridad con bitácora encadenada por hash
- [x] Carga masiva de productos, PWA y app móvil
- [x] Pentest local con hallazgos corregidos

**Pendiente**
- [ ] Integración de despacho con tracking (proveedor en evaluación)
- [ ] Pagos en producción
- [ ] Boleta electrónica (SII)
- [ ] Tests e2e con Playwright sobre el flujo de compra
- [ ] Elasticidad-precio, a medida que se acumula `PriceHistory` real

---

## 👥 Equipo

Proyecto de título (Capstone) de Ingeniería en Informática, DuocUC sede Plaza Norte.

Christ Louidor · Vicente Donoso · Nelson Zarate

Todo cambio entra por `issue → rama → PR` con commits convencionales y ramas `feat/`, `fix/`, `chore/`, `sec/`.

## 📄 Licencia

Software propietario. Todos los derechos reservados. No se permite uso, copia ni distribución
sin autorización expresa del titular.

<div align="center">

Hecho en Recoleta, Santiago de Chile 🇨🇱 · 2026

</div>
