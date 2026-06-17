<div align="center">

# 🐕 Hachiko Store

**E-commerce de productos coreanos para el mercado chileno.**
Snacks, skincare, papelería y merch K-pop — curados e importados, despachados a todo Chile.

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel)](https://vercel.com/)
[![License](https://img.shields.io/badge/license-Proprietary-lightgrey)](#-licencia)

</div>

---

## 📖 Sobre el proyecto

Hachiko es una tienda online full-stack construida sobre Next.js, pensada y desarrollada para una pyme chilena que importa y vende productos coreanos. El proyecto prioriza tres cosas por igual: **experiencia de usuario cálida**, **cumplimiento legal chileno** (Ley 21.719 de datos personales, Ley 19.496 de protección al consumidor, obligaciones SII) y **seguridad por diseño** (OWASP, segregación de roles, mínimo privilegio).

No es un template genérico de e-commerce: cada decisión técnica está documentada y atada a un requisito real de negocio o de normativa.

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
- CRUD de productos y categorías.
- **Gestión de inventario con descuento de stock automático** al confirmar pago, vía sistema de reservas con TTL — sin oversell, sin race conditions.
- Ajuste manual de stock con motivo obligatorio y trazabilidad completa (ledger inmutable).
- Vista de órdenes para despacho con **datos mínimos** según Ley 21.719 (sin RUT, sin historial cruzado, sin medio de pago).

### Seguridad y cumplimiento
- Autenticación con Argon2id + JWT + refresh token rotativo.
- **2FA TOTP** (RFC 6238) compatible con Google / Microsoft Authenticator y Authy, sin SMS.
- RBAC de dos roles (`CLIENT` / `SELLER`) con mínimo privilegio: no existe superusuario.
- Cifrado de PII at-rest con AES-256-GCM.
- Audit log inmutable para acciones sensibles.
- Módulo de monitoreo de amenazas en la trastienda (incidencias tipificadas por ley, bitácora encadenada por hash).
- Validación Zod en todo input, rate limiting, headers de seguridad y CSP estricta.

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

### Reabastecimiento y ajuste manual auditado

El vendedor puede ajustar el stock a mano (reingreso de mercadería a mitad de mes, corrección de conteo, merma, vencimiento, devolución). Cada ajuste:

- **Exige un motivo** (y nota obligatoria si es una corrección).
- **No puede dejar el disponible en negativo** si hay reservas activas — el sistema lo impide y explica por qué.
- Queda registrado con **quién, cuándo, cuánto y por qué**.

### Ledger inmutable

Todo movimiento —venta, reabastecimiento, merma, corrección, devolución— se escribe en una tabla **append-only** que nunca se actualiza ni se borra. Esto permite responder con precisión preguntas como *"¿cuánto vendí de este producto en julio?"* o *"¿quién dejó este SKU en cero el martes?"*, y constituye **respaldo legal ante el SII** y ante cualquier disputa.

```
2026-07-15 14:32 · VENTA    −2   Orden #2741                Stock: 47 → 45
2026-07-15 09:10 · ENTRADA +20   Reabastecimiento (@vendedor) Stock: 27 → 47
                                  Nota: "Llegó el lote de junio"
2026-07-12 11:20 · SALIDA   −1   Mermado (@vendedor)          Stock: 29 → 28
                                  Nota: "Envase roto en bodega"
```

### Dashboard operacional

El panel del vendedor traduce todo esto en una vista accionable: órdenes por despachar, alertas de **bajo stock** (umbral configurable por producto), productos más vendidos, valorización del inventario (a costo y a precio de venta) y tendencia de ventas — actualizado en tiempo casi real.



| Capa | Tecnología |
|------|-----------|
| **Framework** | Next.js 15 (App Router, RSC, Server Actions) |
| **Lenguaje** | TypeScript 5.x (`strict: true`) |
| **UI** | React 19 + TailwindCSS |
| **Formularios** | React Hook Form + Zod |
| **Estado** | Zustand (carrito) + TanStack Query (server state) |
| **ORM** | Prisma 5.x |
| **Base de datos** | PostgreSQL (Neon, serverless) |
| **Auth** | jose (JWT) + Argon2id + iron-session + TOTP |
| **Pagos** | transbank-sdk + mercadopago SDK v2 |
| **Email** | Resend (transaccional) |
| **Despacho** | Abstracción multicourier (agregador en F1, courier directo en F2) |
| **Deploy** | Vercel |
| **Gestor de paquetes** | pnpm (strict, `ignore-scripts`) |

---

## 🚀 Puesta en marcha

### Requisitos previos
- Node.js 20 LTS
- pnpm 9.x (`npm install -g pnpm`)
- Una base de datos PostgreSQL (recomendado: [Neon](https://neon.tech/))
- Cuentas sandbox de Transbank y MercadoPago para pruebas

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/haruxvi/Hachiko_Store.git
cd Hachiko_Store

# 2. Instalar dependencias (con scripts deshabilitados por seguridad)
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# 4. Aplicar el schema a la base de datos
pnpm prisma migrate dev

# 5. (Opcional) Cargar datos de prueba
pnpm db:seed

# 6. Levantar el entorno de desarrollo
pnpm dev
```

La app queda disponible en `http://localhost:3000`.

### Variables de entorno

Todas las variables están documentadas en `.env.example`. Las imprescindibles:

```bash
DATABASE_URL=          # conexión Neon (pooled)
DIRECT_URL=            # conexión directa para migraciones
JWT_SECRET=            # openssl rand -hex 32
SESSION_SECRET=        # iron-session
DATA_ENCRYPTION_KEY=   # AES-256-GCM para PII
TBK_ENV=integration    # transbank
MP_ACCESS_TOKEN=       # mercadopago
RESEND_API_KEY=        # email transaccional
CRON_SECRET=           # auth de cron jobs
```

> ⚠️ **Nunca** commitees `.env.local`. Las credenciales de seed son de uso local exclusivo.

---

## 📜 Scripts disponibles

```bash
pnpm dev            # entorno de desarrollo
pnpm build          # build de producción
pnpm start          # servir build de producción
pnpm lint           # ESLint
pnpm typecheck      # verificación de tipos
pnpm test           # tests unitarios (Vitest)
pnpm test:e2e       # tests end-to-end (Playwright)
pnpm audit          # auditoría de seguridad de dependencias
pnpm prisma studio  # explorador visual de la base de datos
pnpm db:seed        # cargar datos de prueba
```

---

## 🗂️ Estructura del proyecto

```
src/
├── app/
│   ├── (storefront)/     # tienda pública (home, catálogo, producto, checkout)
│   ├── (account)/        # cuenta del cliente (perfil, pedidos, datos ARCOP)
│   ├── (panel)/          # trastienda (dashboard, productos, inventario, órdenes)
│   └── api/              # route handlers (auth, pagos, webhooks, cron)
├── lib/
│   ├── auth/            # JWT, sesión, RBAC, TOTP
│   ├── crypto/          # cifrado de PII
│   ├── services/        # lógica de negocio (orders, catalog, inventory, payments…)
│   ├── payments/        # integración Transbank + MercadoPago
│   ├── shipping/        # abstracción multicourier
│   └── validation/      # schemas Zod compartidos
├── actions/             # Server Actions
├── components/          # UI (ui primitives, storefront, panel)
└── middleware.ts        # auth + RBAC en edge

prisma/
├── schema.prisma
└── migrations/

docs/                    # documentación viva del proyecto
```

---

## 🔒 Ciberseguridad

La seguridad no es una capa que se agregó al final: está construida dentro de la arquitectura. Esta sección detalla lo que se implementó concretamente en la plataforma, no buenas intenciones genéricas.

### Autenticación y gestión de sesiones
- **Hash de contraseñas con Argon2id** (memory-hard), parámetros endurecidos contra ataques de fuerza bruta por GPU.
- **JWT de acceso de vida corta** (15 min) firmado con jose, más **refresh token rotativo** en cookie `httpOnly` / `secure` / `sameSite: strict`.
- **Invalidación global de sesiones** vía `tokenVersion`: al cambiar contraseña o detectar abuso, todas las sesiones activas del usuario mueren de inmediato.
- **Bloqueo de cuenta** tras 5 intentos fallidos en ventana de 15 minutos.

### Doble factor (2FA) — TOTP estándar
- Implementación **RFC 6238**, compatible con Google Authenticator, Microsoft Authenticator y Authy. Sin SMS, sin servicios pagados, sin dependencia de terceros.
- El **secreto se guarda cifrado con AES-256-GCM**; el QR se genera en el propio servidor — el secreto nunca pasa por un tercero.
- El código 2FA se solicita **solo después** de validar la contraseña, de modo que el flujo **no revela qué cuentas tienen 2FA activado** (anti-enumeración).
- Los códigos errados **cuentan para el bloqueo de cuenta**; desactivar 2FA **exige un código vigente**.
- Activación y desactivación quedan registradas en el **AuditLog**. Cubierto con tests unitarios propios.

### Control de acceso (RBAC + mínimo privilegio)
- Dos roles con principio de **mínimo privilegio**: `CLIENT` (compra) y `SELLER` (opera la tienda). **No existe un superusuario** — es una decisión de diseño deliberada.
- El **vendedor no es un superadministrador**: puede gestionar catálogo, inventario y ver lo justo para despachar, pero **no accede a la PII completa de los clientes** — así se evita infringir la Ley 21.719.
- La verificación de rol ocurre en el **edge middleware** *antes* de llegar a la página, y de nuevo en cada route handler y server action vía `requireRole()`: el middleware es la primera capa, no la única. Si el rol no corresponde, los datos sensibles ni siquiera se cargan.
- Las órdenes solo son accesibles por su dueño (filtrado por `userId`, sin IDOR); la eliminación de cuenta está restringida al propio cliente.

### Protección de datos en reposo y en tránsito
- **Cifrado de PII con AES-256-GCM** (nombre, dirección, teléfono, email de despacho), desencriptado únicamente en la capa de servicio cuando el rol lo autoriza.
- HTTPS forzado con **HSTS**; headers de seguridad (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) y **CSP estricta** configurados a nivel de framework.

### Validación, abuso y superficie de ataque
- **Validación con Zod en todo input** (body, params, query), compartida entre cliente y servidor.
- **Rate limiting** por IP y por usuario en endpoints sensibles (login, registro, pagos).
- Consultas **siempre parametrizadas vía Prisma** — sin SQL crudo construido con strings.
- **Patrón anti-enumeración**: respuestas idénticas exista o no un email, tanto en login como en recuperación de contraseña.

### Pagos
- **Confirmación server-side obligatoria**: nunca se confía en el redirect del cliente para marcar una orden como pagada.
- **Webhooks con firma verificada** (HMAC en MercadoPago) e **idempotencia** vía tabla de webhooks procesados — un evento duplicado no descuenta stock dos veces.
- **Cero almacenamiento de datos de tarjeta**: la tokenización ocurre en la pasarela.

### Cadena de suministro (supply chain)
- **pnpm con `ignore-scripts`** activado: los `postinstall` maliciosos —vector clásico de los ataques npm recientes— no se ejecutan.
- **Lockfile siempre committeado**; CI instala con `--frozen-lockfile`.
- **Versiones exactas** (sin `^`) en dependencias de auth, criptografía y pagos.
- **Auditoría automática semanal** + **Dependabot** con revisión humana obligatoria antes de mergear cualquier bump.

### Auditoría
- **AuditLog inmutable** (append-only) para eventos sensibles: login, cambios de rol, acceso a PII, activación/desactivación de 2FA, ajustes de stock, exports de datos.

### Monitoreo de amenazas en la trastienda

El vendedor cuenta con un módulo de seguridad propio en `/trastienda/seguridad` que registra y muestra las incidencias de ciberseguridad de la plataforma (por ejemplo, intentos de acceso forzado / fuerza bruta al login, bloqueos de cuenta y otros eventos relevantes). No es solo un log técnico: está diseñado conforme al marco legal chileno.

- **Tipificación legal:** cada incidencia se clasifica según la **Ley 21.459** (delitos informáticos), con flujo de **notificación a la autoridad** cuando corresponde (**Ley 21.663** de ciberseguridad y **Ley 21.719** de datos personales → Agencia de Protección de Datos).
- **Bitácora encadenada por hash SHA-256** (append-only): cada evento se enlaza criptográficamente con el anterior, de modo que **alterar o borrar un registro rompe la cadena** y queda en evidencia. Incluye verificación de integridad (`verifyChain`).
- **Tratamiento de IP conforme a la ley:** las direcciones IP asociadas a incidencias se conservan por el período definido con **fines exclusivos de eventual acción legal o investigación**, se **anonimizan** y se **eliminan automáticamente** al expirar, mediante un cron de limpieza programado. Esto equilibra la capacidad de respuesta a incidentes con la minimización de datos que exige la Ley 21.719.

> La retención de IP se rige por la política definida en el cron de limpieza de auditoría (`src/app/api/cron/clean-audit-logs/route.ts`); ajusta el plazo en la documentación si cambia en el código.

> ¿Encontraste una vulnerabilidad? No abras un issue público. Escribe al canal de seguridad privado del proyecto.

---

## ⚖️ Cumplimiento legal (Chile)

- **Ley 21.719** — Protección de datos personales (consentimiento granular, derechos ARCOP, registro de tratamiento, minimización de PII).
- **Ley 21.459** — Delitos informáticos (tipificación de incidencias de seguridad en el módulo de la trastienda).
- **Ley 21.663** — Marco de ciberseguridad (flujo de notificación de incidentes a la autoridad).
- **Ley 19.496** — Protección al consumidor (derecho a retracto, precios con IVA, T&C, política de devoluciones).
- **SII** — Boleta electrónica e inicio de actividades de comercio electrónico.

---

## 🗺️ Roadmap

El roadmap completo vive en [`docs/roadmap-mejoras.md`](docs/roadmap-mejoras.md). Hitos principales:

- [x] Autenticación + RBAC + 2FA
- [x] Catálogo + carrito + checkout
- [x] Inventario con stock automático
- [ ] Integración de pagos en producción
- [ ] Recuperación de contraseña + verificación de email
- [ ] Boleta electrónica (SII)
- [ ] Costo de envío por zona + retiro en tienda
- [ ] Correos transaccionales con tracking
- [ ] SEO técnico

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
