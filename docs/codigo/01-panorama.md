# 1. Panorama general y arquitectura

## Qué es

Hachiko es una tienda en línea chilena de productos coreanos (snacks, skincare, papelería y
K-pop). El sistema tiene **tres caras** para dos tipos de usuario:

- **Cliente:** la tienda web, instalable como PWA, y la app móvil.
- **Vendedor:** la *trastienda*, un panel web (también disponible en la app) para operar la
  tienda y ver su inteligencia de negocio.

Las tres usan **el mismo backend, la misma base de datos y las mismas reglas**. No hay una
lógica de negocio distinta para la app.

## Piezas y tecnologías

| Pieza | Tecnología | Dónde vive |
|---|---|---|
| Web y backend | Next.js 16 (App Router, React 19, Server Components y Server Actions) sobre Node 20, en TypeScript | `src/` |
| Base de datos | PostgreSQL (Neon en producción, Docker en local) con Prisma 6 como ORM y dueño del esquema | `prisma/schema.prisma` |
| Validación de entradas | zod 4: un esquema por entrada, en el servidor | `src/lib/validation/schemas.ts` |
| Pagos | Transbank Webpay Plus (`transbank-sdk`) y Mercado Pago | `src/lib/payments/` |
| Correos | Resend (HTML propio, sin plantillas de terceros) | `src/lib/email.ts` |
| Fotos de productos | Vercel Blob | `src/lib/product-image.ts` |
| App móvil | Expo SDK 58 (React Native 0.88, expo-router, TanStack Query) | `mobile/` |
| Machine learning | Python 3.12: pandas, numpy y scikit-learn, con SQLAlchemy + psycopg | `ml/` |
| Hosting | Vercel (web y API) y GitHub Actions (entrenamiento ML, CI) | `vercel.json`, `.github/workflows/` |

## La arquitectura en una imagen

```
   Web / PWA          App Expo
       │                  │  /api/v1 (Bearer)
       ▼                  ▼
 ┌───────────────────────────────────────────────┐
 │ ENTRADA   middleware (CSP + RBAC de páginas)   │  src/middleware.ts
 │           páginas, Server Actions,             │  src/app/, src/actions/
 │           route handlers (/api, /api/v1)       │  src/app/api/
 ├───────────────────────────────────────────────┤
 │ SERVICIOS reglas de negocio (una sola vez)     │  src/lib/services/
 │           + módulos compartidos                │  src/lib/*.ts
 ├───────────────────────────────────────────────┤
 │ DATOS     Prisma → PostgreSQL                  │  src/lib/db.ts
 └───────────────────────────────────────────────┘
                          ▲
                          │ escribe SOLO tablas derivadas
                 Pipeline ML en Python (ml/), diario en GitHub Actions
```

### Tres capas

1. **Entrada.** Recibe la petición, autentica, valida con zod y llama a un servicio. Nunca
   tiene reglas de negocio propias. Hay tres tipos de entrada:
   - **Páginas** (`src/app/**/page.tsx`): Server Components que leen datos directamente en el
     servidor.
   - **Server Actions** (`src/actions/*.ts`): las mutaciones de la web (checkout, despachar,
     ajustar stock…). Usan la cookie de sesión.
   - **Route handlers** (`src/app/api/**/route.ts`): pasarelas de pago, webhooks, crons, login y
     la API v1 de la app, que usa token Bearer.
2. **Servicios** (`src/lib/services/*.service.ts`). Cada regla vive aquí **una sola vez**. Por
   ejemplo, `createOrder` en [order.service.ts](../../src/lib/services/order.service.ts) lo
   usan el checkout web y nadie más crea pedidos por otro camino. Cuando la web y la app hacen
   lo mismo (por ejemplo, editar un producto), ambas llaman al mismo módulo
   ([catalog-admin.ts](../../src/lib/catalog-admin.ts),
   [product-import.ts](../../src/lib/product-import.ts)).
3. **Datos.** Prisma es el único que crea y modifica tablas (DDL). El esquema completo está en
   [schema.prisma](../../prisma/schema.prisma).

### Dos planos de datos en la misma base

| Plano | Tablas | Quién escribe |
|---|---|---|
| **Operacional** (el día a día) | `User`, `Product`, `Order`, `OrderItem`, `StockMovement`, `StockReservation`, `PriceHistory`, `AuditLog`, `SecurityIncident`… | La app web, en cada operación |
| **Analítico** (predicciones) | `ModelRun`, `KpiSnapshot`, `DemandForecast`, `RestockSuggestion`, `ProductRecommendation`, `CustomerSegment`, `RiskScore` | Solo el pipeline de Python, una vez al día |

La trastienda **lee** el plano analítico con
[intelligence.service.ts](../../src/lib/services/intelligence.service.ts). El pipeline de Python
nunca toca las tablas operacionales: solo las lee. El detalle está en
[09-inteligencia.md](09-inteligencia.md).

## Recorrido de una petición: "un cliente paga su carrito"

1. El navegador envía el formulario de checkout. Corre la Server Action `checkoutAction`
   ([cart.ts](../../src/actions/cart.ts)).
2. La acción lee la sesión desde la cookie cifrada, aplica límites de frecuencia (12 pedidos
   cada 5 minutos por usuario y 20 por IP) y valida todo con `CheckoutSchema`.
3. `createOrder` abre **una transacción Serializable** que, de una vez:
   - lee los precios desde la base (nunca del navegador);
   - descuenta las reservas vigentes;
   - crea el pedido con la dirección **cifrada**;
   - reserva el stock por 15 minutos;
   - registra el primer estado en el historial.
4. El navegador pide `/api/payments/webpay/create`, recibe la URL y el token de Transbank, y
   envía el formulario hacia Transbank.
5. Transbank devuelve al cliente a `/api/payments/webpay/commit`. El servidor confirma con
   Transbank y toma el **monto y el pedido desde la respuesta de Transbank**.
6. `confirmPaymentAndMarkPaid` ([payment.service.ts](../../src/lib/services/payment.service.ts))
   hace en otra transacción Serializable: verifica el monto, descuenta el stock físico, registra
   el movimiento y marca el pedido como pagado. Todo o nada.
7. El cliente ve `/checkout/success` y recibe el correo de confirmación.

El detalle de cada paso está en [03-compra.md](03-compra.md) y
[04-pagos-y-reembolsos.md](04-pagos-y-reembolsos.md).

## Dónde está cada cosa

```
src/
├── app/
│   ├── (storefront)/   tienda pública: catálogo, producto, carrito, login, registro
│   ├── (checkout)/     checkout y páginas de éxito/fallo del pago
│   ├── (account)/      cuenta del cliente: perfil, pedidos, devoluciones, mis datos (ARCOP)
│   ├── (panel)/        trastienda: operación, Inteligencia y Seguridad (solo SELLER)
│   ├── legal/          privacidad, términos, cookies, despacho, devoluciones
│   └── api/            auth, pagos, webhooks, crons, analítica y /api/v1 (app móvil)
├── actions/            Server Actions (mutaciones de la web)
├── components/         UI: storefront/, panel/, account/, ui/
├── lib/
│   ├── services/       reglas de negocio (pedidos, pagos, inventario, seguridad…)
│   ├── auth/           JWT cifrado, sesión, rotación de refresh, TOTP, RBAC, crons
│   ├── crypto/         cifrado de datos personales, cadena de integridad, tokens
│   ├── payments/       clientes de Webpay y Mercado Pago
│   ├── validation/     esquemas zod de todas las entradas
│   └── api/            helpers y DTO de la API v1
└── middleware.ts       CSP con nonce por respuesta + protección de rutas por rol
mobile/                 app Expo (src/app = pantallas, src/lib = API, sesión, carrito)
ml/                     pipeline Python (jobs/ = modelos, ml/ = conexión y trazabilidad)
prisma/                 esquema y seeds (base, sintético, seguridad, analítica)
tests/                  unit/, integration/ (Postgres real) y e2e/ (Playwright)
```

## Convenciones que se repiten en todo el código

- **Precios en pesos enteros (CLP)**, en columnas `*CLP` de tipo `Int`. El peso no tiene
  decimales, así que no hay errores de redondeo con punto flotante.
- **Hora de Chile para todo lo que se agrupa por día o mes.** Las fechas se guardan en UTC y se
  convierten a `America/Santiago` al agrupar ([sales.ts](../../src/lib/sales.ts),
  [store-time.ts](../../src/lib/store-time.ts)).
- **"Venta válida" tiene una sola definición:** `paymentStatus = PAID` y `status ≠ CANCELLED`
  (`SALE_WHERE` / `SALE_SQL` en [sales.ts](../../src/lib/sales.ts)). Métricas, ML y
  elasticidad usan esa misma definición.
- **Fail-closed:** ante la duda se rechaza. Ejemplos: el endpoint de cron sin secreto
  configurado queda cerrado; un pago sin monto no se confirma.
- **Cada cambio relevante deja rastro** en `AuditLog` (quién, qué, cuándo) y, en los pedidos,
  en `OrderStatusHistory`.
