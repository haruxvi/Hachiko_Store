<div align="center">

# 🐕 Hachiko Store

**Comercio electrónico inteligente y seguro de productos coreanos para el mercado chileno.**
Snacks, skincare, papelería y merch K-pop — curados e importados, despachados a todo Chile,
con una capa de análisis de datos y machine learning sobre la operación.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-ML-F7931E?logo=scikitlearn&logoColor=white)](https://scikit-learn.org/)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel)](https://vercel.com/)
[![License](https://img.shields.io/badge/license-Proprietary-lightgrey)](#-licencia)

</div>

---

## 📖 Sobre el proyecto

Hachiko es una tienda online full-stack construida sobre Next.js, pensada y desarrollada para una pyme chilena que importa y vende productos coreanos. El proyecto prioriza cuatro cosas por igual: **experiencia de usuario cálida**, **cumplimiento legal chileno** (Ley 21.719 de datos personales, Ley 19.496 de protección al consumidor, obligaciones SII), **seguridad por diseño** (OWASP, segregación de roles, mínimo privilegio) y **una capa de inteligencia** (análisis de datos + machine learning) que convierte la operación diaria en decisiones.

No es un template genérico de e-commerce: cada decisión técnica está documentada y atada a un requisito real de negocio o de normativa. La IA no es un apéndice pegado encima — está gobernada, respeta el consentimiento y se apoya en la misma postura de seguridad del resto del sistema (por ejemplo, detecta fraude y ataques sobre los propios registros de la plataforma).

---

## ✨ Características

### Tienda (cliente)
- Catálogo navegable por categorías con búsqueda y filtros.
- Carrito persistente y checkout en una sola página.
- Pago con **Transbank Webpay Plus** y **MercadoPago**.
- Seguimiento de pedidos con estados en vivo y tracking de despacho.
- Gestión de cuenta con derechos ARCOP (acceso, rectificación, cancelación, oposición, portabilidad).

### Trastienda (vendedor)
- Dashboard con KPIs operacionales y comerciales en tiempo casi real.
- CRUD de productos y categorías, con **edición de precio auditada** (cada cambio queda en un historial).
- **Gestión de inventario con descuento de stock automático** al confirmar pago, vía sistema de reservas con TTL — sin oversell, sin race conditions.
- Ajuste manual de stock con motivo obligatorio y trazabilidad completa (ledger inmutable).
- Vista de órdenes para despacho con **datos mínimos** según Ley 21.719 (sin RUT, sin historial cruzado, sin medio de pago).
- **Grupo "Inteligencia"** con 10 vistas de análisis y predicción (ver más abajo).

### Seguridad y cumplimiento
- Autenticación con Argon2id + JWT + refresh token rotativo.
- **2FA TOTP** (RFC 6238) compatible con Google / Microsoft Authenticator y Authy, sin SMS.
- RBAC de dos roles (`CLIENT` / `SELLER`) con mínimo privilegio: no existe superusuario.
- Cifrado de PII at-rest con AES-256-GCM.
- Audit log inmutable para acciones sensibles.
- Módulo de monitoreo de amenazas en la trastienda (incidencias tipificadas por ley, bitácora encadenada por hash).
- Validación Zod en todo input, rate limiting, headers de seguridad y CSP estricta.

---

## 🧠 Inteligencia: análisis de datos y Machine Learning

Un e-commerce genera datos valiosos (ventas, inventario, comportamiento, seguridad). Este subsistema los aprovecha para apoyar la operación con **análisis descriptivo (BI)** y **modelos predictivos (ML)**, siguiendo la metodología estándar **CRISP-DM**. Documentación completa y detallada en [`docs/machine-learning.md`](docs/machine-learning.md).

### Arquitectura de dos planos

El entrenamiento de modelos **no corre en Vercel** (serverless, con timeouts y librerías pesadas): corre por *batch* en un proyecto Python independiente, y se comunica con la app **solo a través de la base de datos**.

```
┌──────────────────────────────┐        ┌───────────────────────────────┐
│  PLANO OPERACIONAL (OLTP)    │        │   PLANO ANALÍTICO / ML        │
│  esquema de la tienda        │──lee──▶│  /ml — Python, pandas,        │
│  User, Product, Order...     │ crudo  │  scikit-learn                 │
│  + AnalyticsEvent, PriceHist.│        │  corre en GitHub Actions      │
│  + OrderStatusHistory        │        │  (cron), NUNCA en Vercel      │
└──────────────────────────────┘        └───────────────┬───────────────┘
              ▲                                          │ escribe
              │  Next.js LEE resultados con Prisma       │ predicciones
              └──────────────────────────────────────────┘
```

**Regla de oro:** Prisma es el único dueño del esquema; Python solo lee lo operacional y escribe las tablas derivadas. Toda predicción referencia el `ModelRun` (versión + métricas) que la generó — trazabilidad de punta a punta, el espejo analítico del `AuditLog`.

### Modelos y técnicas

| Módulo | Técnica | Salida |
|--------|---------|--------|
| Forecast de demanda | Regresión Ridge con estacionalidad (mes one-hot + tendencia) | Pronóstico por producto, 3 meses |
| Reposición | Forecast + lead time + stock | Qué comprar y cuánto, días a quiebre |
| Recomendador | Reglas de asociación (soporte / confianza / lift) | "Se compran juntos" |
| Segmentación de clientes | RFM + clustering **KMeans** (silhouette) | Segmentos + clusters |
| Fraude en órdenes | **Isolation Forest** (no supervisado) | Órdenes atípicas + señales |
| Account-takeover | Detección por reglas (fuerza bruta + credential stuffing) | Cuentas bajo ataque |
| KPIs / BI | Agregaciones sobre ventas pagadas | Ingresos, margen, ABC, geo |

Principio transversal: **el modelo sugiere, la decisión es humana** — no hay decisiones automáticas con efecto jurídico sobre personas.

### Las 10 vistas del panel "Inteligencia"

**Métricas** (KPIs, márgenes, ABC, ventas por comuna, anomalías, alertas) · **Demanda** (forecast + productos en alza/baja) · **Qué reponer** (reposición + mermas + sobre-stock) · **Logística** (demanda y costo de envío por región, SLA por courier) · **Recomendaciones** (se compran juntos + packs) · **Clientes** (RFM, CLV, recompra/churn) · **Conversión** (embudo, carritos, búsquedas sin resultado) · **Riesgo** (fraude, cuentas atacadas, incidentes) · **Modelos** (trazabilidad y salud del pipeline) · **Reporte** (resumen ejecutivo imprimible a PDF).

### Privacidad por diseño (Ley 21.719)

El perfilado y las recomendaciones personalizadas operan **solo sobre usuarios con consentimiento** (`consentMarketing`); el pipeline entrena sobre datos **pseudonimizados** (nunca ve email ni teléfono); y las decisiones relevantes quedan auditables. La analítica agregada (KPIs, márgenes) no usa datos personales.

---

## 📦 Gestión de inventario (apartado de valor)

El módulo de inventario es uno de los diferenciadores técnicos del proyecto. No se limita a sumar y restar un número: resuelve concurrencia, previene sobreventa y mantiene un registro contable completo de cada unidad que entra y sale.

### Descuento de stock automático en tiempo real

El stock **no** se descuenta al agregar al carrito (bloquearía unidades injustamente) ni al despachar (permitiría vender la misma unidad varias veces). Se usa un **patrón de reserva con TTL**:

```
1. El cliente confirma el checkout
   → en una transacción atómica se verifica disponibilidad
     y se crea una RESERVA con vencimiento de 15 minutos.

2. El pago se confirma (webhook de la pasarela)
   → el stock físico se descuenta de verdad,
     la reserva se elimina y se registra el movimiento.

3. El pago falla o la reserva expira
   → un cron libera la reserva y el stock vuelve a estar disponible.
```

### Sin sobreventa, sin race conditions

Las operaciones de stock corren dentro de transacciones con **nivel de aislamiento `Serializable`** y reintentos con backoff exponencial. Si dos clientes intentan comprar la última unidad al mismo tiempo, **uno gana y el otro recibe un error claro** — nunca se venden dos unidades inexistentes. Esto está cubierto por un test de concurrencia que lanza cinco compras paralelas sobre una sola unidad y verifica que exactamente una tenga éxito.

### Stock físico vs. disponible

| Concepto | Definición |
|----------|-----------|
| **Físico** | Unidades reales en bodega |
| **Reservado** | Unidades apartadas en órdenes pendientes de pago (no expiradas) |
| **Disponible** | Físico − Reservado — *lo que realmente puede comprar un cliente* |

El cliente solo ve "disponible" o "agotado". El vendedor ve los tres valores en la vista de inventario.

### Ledgers inmutables (stock y precio)

Todo movimiento de stock —venta, reabastecimiento, merma, corrección, devolución— se escribe en una tabla **append-only** que nunca se actualiza ni se borra. Del mismo modo, **cada cambio de precio queda registrado en `PriceHistory`** (precio anterior → nuevo, quién y cuándo). Esto da respaldo legal ante el SII, responde preguntas como *"¿quién dejó este SKU en cero el martes?"*, y —en el caso del precio— **habilita el análisis de elasticidad con datos reales** que se acumulan con el uso.

```
2026-07-15 14:32 · VENTA    −2   Orden #2741                Stock: 47 → 45
2026-07-15 09:10 · ENTRADA +20   Reabastecimiento (@vendedor) Stock: 27 → 47
                                  Nota: "Llegó el lote de junio"
2026-07-12 11:20 · SALIDA   −1   Mermado (@vendedor)          Stock: 29 → 28
```

---

## 🧰 Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| **Framework** | Next.js 16 (App Router, RSC, Server Actions) |
| **Lenguaje** | TypeScript 5.x (`strict: true`) |
| **UI** | React 19 + TailwindCSS (sistema de diseño propio "Shiba pastel") |
| **Formularios** | React Hook Form + Zod 4 |
| **Estado** | Zustand (carrito) + TanStack Query (server state) |
| **ORM** | Prisma 6.x |
| **Base de datos** | PostgreSQL (Neon, serverless) |
| **Auth** | jose (JWT) + Argon2id + iron-session + TOTP |
| **Pagos** | transbank-sdk + mercadopago SDK v2 |
| **Email** | Resend (transaccional) |
| **ML / análisis** | Python 3.12+, pandas, scikit-learn, SQLAlchemy + psycopg |
| **Orquestación ML** | GitHub Actions (cron) — entrenamiento batch fuera de Vercel |
| **Deploy** | Vercel |
| **Gestor de paquetes** | pnpm (strict, `ignore-scripts`) |

---

## 🚀 Puesta en marcha

### Requisitos previos
- Node.js 20 LTS · pnpm 9.x (`npm install -g pnpm`)
- Python 3.12+ (solo para el pipeline de ML)
- Una base de datos PostgreSQL:
  - **[Neon](https://neon.tech/)** (cloud, recomendado), o
  - **Docker local**: ver [`docs/despliegue-local-docker.md`](docs/despliegue-local-docker.md).
- Cuentas sandbox de Transbank y MercadoPago para pruebas.

### Instalación de la app

```bash
git clone https://github.com/haruxvi/Hachiko_Store.git
cd Hachiko_Store

pnpm install                       # scripts deshabilitados por seguridad (.npmrc)
cp .env.example .env               # editar con tus credenciales
pnpm db:generate                   # cliente Prisma
pnpm exec prisma db push           # sincronizar el esquema (sin migrations/)
pnpm dev                           # http://localhost:3000
```

> ⚠️ No uses `prisma migrate dev`: este repo no versiona migraciones, el esquema se sincroniza con `prisma db push`.

### Datos de demostración (desarrollo)

Los modelos necesitan datos. En desarrollo se generan con **datos sintéticos** (falsos, marcados y borrables), nunca reales. El **orden importa** (synthetic primero):

```bash
pnpm db:seed:synthetic   # ~24 meses, catálogo, clientes y ~9.000 pedidos con estacionalidad
pnpm db:seed:security    # eventos de login fallidos + incidentes (vista Riesgo)
pnpm db:seed:analytics   # eventos de navegación/carrito (vista Conversión)
```

Guía detallada para el equipo (qué hace cada uno, idempotencia, marcadores) en [`docs/machine-learning.md`](docs/machine-learning.md) §8.6.

### Pipeline de ML (local)

```bash
cd ml
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt   # Windows
.venv\Scripts\python -m jobs.train_all           # entrena todos los modelos
```

Lee `DIRECT_URL` del `.env` de la raíz. En la nube corre solo, por cron, vía GitHub Actions
([`.github/workflows/ml-train.yml`](.github/workflows/ml-train.yml)); necesita el secret
`NEON_DIRECT_URL` en el repositorio.

### Variables de entorno

Documentadas en `.env.example`. Imprescindibles:

```bash
DATABASE_URL=          # conexión Neon (pooled)
DIRECT_URL=            # conexión directa (migraciones + pipeline ML)
JWT_SECRET=            # openssl rand -hex 32
SESSION_SECRET=        # iron-session
DATA_ENCRYPTION_KEY=   # AES-256-GCM para PII
TBK_ENV=integration    # transbank
MP_ACCESS_TOKEN=       # mercadopago
RESEND_API_KEY=        # email transaccional
CRON_SECRET=           # auth de cron jobs
```

> ⚠️ **Nunca** commitees `.env`. Las credenciales de seed son de uso local exclusivo.

---

## 📜 Scripts disponibles

```bash
# App
pnpm dev                # desarrollo            pnpm build / pnpm start
pnpm lint               # ESLint                pnpm typecheck   # tipos
pnpm test               # Vitest                pnpm test:e2e    # Playwright
pnpm audit              # auditoría de deps

# Base de datos y datos de demo
pnpm db:studio          # explorador visual     pnpm db:generate # cliente Prisma
pnpm db:seed            # usuarios de prueba
pnpm db:seed:synthetic  # dataset sintético (~9.000 pedidos)
pnpm db:seed:security   # eventos de seguridad + incidentes
pnpm db:seed:analytics  # eventos de comportamiento

# Pipeline de ML (desde ml/)
python -m jobs.train_all          # entrena todos los modelos
python -m jobs.forecast_demand    # (o un job individual)
```

---

## 🗂️ Estructura del proyecto

```
src/
├── app/
│   ├── (storefront)/     # tienda pública (home, catálogo, producto, checkout)
│   ├── (account)/        # cuenta del cliente (perfil, pedidos, datos ARCOP)
│   ├── (panel)/          # trastienda: día a día + grupo "Inteligencia" (10 vistas)
│   └── api/              # route handlers (auth, pagos, webhooks, cron)
├── lib/
│   ├── auth/  crypto/  payments/  shipping/  validation/
│   └── services/         # lógica de negocio (orders, catalog, inventory,
│                         #   intelligence.service.ts = lectura del plano analítico)
├── actions/              # Server Actions
├── components/           # UI (ui, storefront, panel)
└── middleware.ts         # auth + RBAC en edge

ml/                       # pipeline de análisis de datos y ML (Python)
├── ml/                   # db.py (conexión Neon), model_run.py (trazabilidad)
├── jobs/                 # kpi_snapshots, forecast_demand, restock, market_basket,
│                         #   customer_rfm, fraud_detection, account_takeover, train_all
└── requirements.txt

prisma/
├── schema.prisma         # operacional + plano analítico (se sincroniza con db push)
├── seed.ts               # usuarios de prueba
├── seed-synthetic.ts     # dataset sintético de negocio
├── seed-security-events.ts
└── seed-analytics-events.ts

.github/workflows/ml-train.yml   # entrenamiento programado (cron)
docs/                            # documentación viva (incl. machine-learning.md)
```

---

## 🔒 Ciberseguridad

La seguridad no es una capa que se agregó al final: está construida dentro de la arquitectura. Esta sección detalla lo que se implementó concretamente, no buenas intenciones genéricas.

### Autenticación y sesiones
- **Argon2id** (memory-hard) endurecido contra fuerza bruta por GPU.
- **JWT de acceso corto** (15 min) + **refresh token rotativo** en cookie `httpOnly`/`secure`/`sameSite:strict`.
- **Invalidación global** vía `tokenVersion`; **bloqueo de cuenta** tras 5 fallos en 15 min.

### Doble factor (2FA) — TOTP
- **RFC 6238**, compatible con Google/Microsoft Authenticator y Authy, sin SMS.
- Secreto **cifrado con AES-256-GCM**; QR generado en el servidor.
- El 2FA se pide **solo tras validar contraseña** (anti-enumeración); desactivarlo exige un código vigente. Todo queda en el `AuditLog`.

### Control de acceso (RBAC + mínimo privilegio)
- Dos roles: `CLIENT` (compra) y `SELLER` (opera la tienda). **No existe superusuario.**
- El vendedor **no accede a la PII completa** de los clientes (Ley 21.719).
- Verificación de rol en el **edge middleware** y de nuevo en cada route handler/server action vía `requireRole()`. Órdenes accesibles solo por su dueño (sin IDOR).

### Datos, abuso y superficie de ataque
- **PII cifrada con AES-256-GCM**; HTTPS con **HSTS**, headers de seguridad y **CSP estricta**.
- **Validación Zod** en todo input; **rate limiting** por IP y usuario; consultas siempre parametrizadas vía Prisma.

### Pagos
- **Confirmación server-side obligatoria** (nunca se confía en el redirect del cliente).
- **Webhooks con firma verificada** + **idempotencia** (un evento duplicado no descuenta stock dos veces). **Cero almacenamiento de datos de tarjeta.**

### Cadena de suministro y auditoría
- **pnpm `ignore-scripts`**, lockfile committeado, versiones exactas en auth/cripto/pagos, **Dependabot + CodeQL** (code scanning + secret scanning) activos.
- **AuditLog inmutable** (append-only) para eventos sensibles.

### Detección con ML (Fase de inteligencia)
Sobre los propios registros de la plataforma, el pipeline detecta **fraude en órdenes** (Isolation Forest) y **ataques de fuerza bruta / credential stuffing** (sobre `AuditLog`), marcando casos para **revisión humana**. Es donde la IA y la ciberseguridad se refuerzan mutuamente.

### Monitoreo de amenazas en la trastienda
Módulo en `/trastienda/seguridad` con **tipificación legal** (Ley 21.459), flujo de **notificación a la autoridad** (Leyes 21.663 / 21.719) y **bitácora encadenada por hash SHA-256** (`verifyChain`): alterar o borrar un registro rompe la cadena. Las IP asociadas se conservan con fines de eventual acción legal, se **anonimizan** y se **eliminan automáticamente** al expirar (cron de limpieza), equilibrando respuesta a incidentes con minimización de datos.

> ¿Encontraste una vulnerabilidad? No abras un issue público. Escribe al canal de seguridad privado del proyecto.

---

## ⚖️ Cumplimiento legal (Chile)

- **Ley 21.719** — Protección de datos personales (consentimiento granular, ARCOP, minimización de PII, perfilado con consentimiento).
- **Ley 21.459** — Delitos informáticos (tipificación de incidencias en la trastienda).
- **Ley 21.663** — Marco de ciberseguridad (notificación de incidentes a la autoridad).
- **Ley 19.496** — Protección al consumidor (retracto, precios con IVA, T&C, devoluciones).
- **SII** — Boleta electrónica e inicio de actividades de comercio electrónico.

Documentación de cumplimiento y calidad en [`docs/`](docs/): ISO 25010/25012, ISO 12207, IEEE 730, CMMI, OWASP, retención/anonimización de datos y el subsistema de ML.

---

## 🗺️ Roadmap

Hitos principales (el detalle vive en [`docs/`](docs/)):

- [x] Autenticación + RBAC + 2FA
- [x] Catálogo + carrito + checkout
- [x] Inventario con stock automático + ledger + historial de precios
- [x] **Subsistema de inteligencia: BI + ML (Fases 0–5)** — 10 vistas, pipeline de modelos en CI
- [x] Detección de fraude y ataques con ML
- [x] Autenticación de doble factor (2FA TOTP)

**Próximo (confirmado):**
- [ ] Correos transaccionales — confirmación de compra y recuperación de contraseña (vía Resend)
- [ ] Integración de couriers **Starken + Correos de Chile** con tracking real de despacho
- [ ] Integración de pagos en producción

**Más adelante (por evaluar):**
- [ ] SEO técnico
- [ ] Costo de envío por zona en el checkout (el retiro en tienda ya está disponible)
- [ ] Boleta electrónica al SII (según disponibilidad de tiempo)
- [ ] Elasticidad-precio (a medida que se acumula `PriceHistory` real)

---

## 🤝 Contribuir

Proyecto privado en desarrollo. Todo cambio entra por el flujo: `issue → rama → PR` con la Definition of Done documentada. Convención de ramas: `feat/`, `fix/`, `chore/`, `sec/`. Commits convencionales obligatorios.

---

## 📄 Licencia

Software propietario. Todos los derechos reservados. No se permite uso, copia ni distribución sin autorización expresa del titular.

---

<div align="center">

Hecho con cariño en Recoleta, Santiago de Chile 🇨🇱 · 2026

</div>
