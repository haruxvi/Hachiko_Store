# 8. El frontend web

La interfaz web está hecha con **Next.js 16 (App Router) y React 19**, con estilos en Tailwind
CSS 3. La regla general es **renderizar en el servidor** y mandar al navegador solo el
JavaScript de las partes interactivas.

## Server Components y Client Components

- **Server Components (por defecto).** Las páginas (`page.tsx`) y los layouts corren en el
  servidor: leen la base, arman el HTML y lo envían listo. No exponen consultas ni secretos al
  navegador y no suman JavaScript al cliente. Hay 49 páginas.
- **Client Components (`'use client'`).** Solo lo que necesita interacción o APIs del navegador:
  el carrito (`localStorage`), los formularios, el aviso de cookies, la galería de fotos o el
  tablero de pedidos. Son 46 archivos, todos en `src/components/`; ninguna página es de cliente.
- **Mutaciones.** Los formularios llaman a **Server Actions** (`src/actions/`). Es una función
  del servidor que el navegador invoca como si fuera local; después, la acción llama a
  `revalidatePath` para que la página se vuelva a pintar con los datos nuevos.

## Rutas y layouts

`src/app/` usa **grupos de rutas**: carpetas entre paréntesis que agrupan páginas con un layout
común, sin aparecer en la URL.

| Grupo | Páginas | Layout |
|---|---|---|
| `(storefront)` | Catálogo, producto, carrito, login, registro, recuperar contraseña, newsletter | Encabezado y pie de la tienda; `dynamic = 'force-dynamic'` (stock y precio siempre al día) |
| `(checkout)` | `/checkout`, éxito y fallo del pago | Encabezado mínimo de "compra segura", sin distracciones |
| `(account)` | `/perfil`, `/pedidos`, devolución de un pedido, `/datos` (derechos ARCOP) | Exige sesión |
| `(panel)` | `/trastienda/*`, 24 páginas | Barra lateral del vendedor; exige SELLER |
| `legal/` | Privacidad, términos, cookies, despacho, devoluciones | Textos legales compartidos (`policies.tsx`) |

La portada (`src/app/page.tsx`), `/offline` (sin conexión) y la página 404 (`not-found.tsx`)
están en la raíz.

### Páginas de la trastienda

- **Día a día:** Resumen, Por despachar (`ordenes`), Cambios y devoluciones, Productos (lista,
  nuevo, editar, carga masiva), Categorías, Inventario (con histórico por producto),
  Promociones.
- **Inteligencia:** Métricas, Demanda, Qué reponer, Logística, Recomendaciones, Clientes,
  Conversión, Riesgo, Modelos, Reporte.
- **Seguridad:** panel de monitoreo, nueva incidencia y detalle de cada incidencia.

## El layout raíz y la CSP

[layout.tsx](../../src/app/layout.tsx) carga las fuentes con `next/font`: Zen Maru Gothic para
títulos, Quicksand para la interfaz, JetBrains Mono para precios y SKU, y Fraunces itálica como
acento editorial.

Llama a `await connection()` para que **ninguna página se prerenderice en el build**. El
middleware genera un *nonce* distinto en cada respuesta y la CSP solo deja correr los scripts
que lo llevan. Una página prerenderizada saldría sin nonce y el navegador bloquearía sus
scripts. El costo es renderizar en cada petición, aceptado a cambio de la protección contra XSS
(ver [10-seguridad-y-privacidad.md](10-seguridad-y-privacidad.md)).

El layout también monta, en todas las páginas, el aviso de cookies, el botón de WhatsApp y el
registro del service worker.

## Estado en el navegador

| Estado | Herramienta | Dónde |
|---|---|---|
| Carrito | zustand con `persist` en `localStorage` | [stores/cart.ts](../../src/lib/stores/cart.ts) |
| Formularios | react-hook-form con validación zod | [CheckoutForm.tsx](../../src/components/storefront/CheckoutForm.tsx) y otros |
| Elección de cookies | `localStorage` (`hachiko.cookieNotice`) | [analytics/client.ts](../../src/lib/analytics/client.ts) |
| Sesión | Cookies `HttpOnly`: el JavaScript **no puede** leerlas | [session.ts](../../src/lib/auth/session.ts) |

No hay una librería de estado global para los datos del servidor: esos datos los entregan los
Server Components ya resueltos.

## Sistema visual

- **Colores como tokens** en [tailwind.config.ts](../../tailwind.config.ts): `cream` de fondo,
  `soot` para el texto, `rust` como acento, más `taupe`, `sand`, `blush` y `alert`. Los
  comentarios del archivo registran el contraste de cada uno: los textos cumplen **WCAG AA**
  (4,5:1), y por eso existe `rust-ink` para el texto naranja.
- **Componentes de clase** en [globals.css](../../src/app/globals.css): `btn-primary`,
  `btn-outline`, `input-hs`, `card-hs`, `chip-*` y `price-mono`. Así todas las pantallas
  comparten el mismo botón y el mismo campo.
- **Íconos y mascota** propios en `src/components/ui/` (`Icon`, `Logo`, `Shiba`), sin
  librerías de íconos externas.
- Las animaciones de entrada (`Reveal.tsx`) usan **un solo** `IntersectionObserver` compartido
  por todas las instancias.
- Las fotos de productos se muestran con `<img>`: pueden venir de cualquier dominio (enlace
  pegado o Vercel Blob), y `next/image` exige declarar cada dominio de antemano.

## PWA (aplicación instalable)

- [manifest.ts](../../src/app/manifest.ts) declara nombre, íconos, `display: standalone` y
  accesos directos a Catálogo, Mi carrito y Mis pedidos.
- [sw.js](../../public/sw.js), el service worker:
  - **Páginas:** siempre a la red y **sin guardarlas**, para que nunca se muestre un pedido o
    un precio viejo, ni datos de otra sesión. Sin conexión, muestra `/offline`.
  - **Recursos estáticos inmutables** (`/_next/static/` e `/icons/`): primero la caché, con un
    tope de entradas.
  - **Todo lo demás** (la API, los datos de React, otros dominios y peticiones que no son GET)
    no pasa por la caché del service worker.

  Está cubierto por [pwa.test.ts](../../tests/unit/pwa.test.ts).

## Accesibilidad y textos

- Formularios con `<label htmlFor>` asociado a cada campo. Los e2e de Playwright los ubican así,
  igual que un lector de pantalla.
- Regiones con nombre (por ejemplo, el aviso de cookies es `role="region"` "Aviso de cookies").
- Botones con `aria-label` cuando solo tienen ícono (por ejemplo, "Agregar uno" y "Quitar uno"
  del selector de cantidad).
- Todo el texto está en español de Chile, con precios en CLP y fechas en hora de Santiago.
