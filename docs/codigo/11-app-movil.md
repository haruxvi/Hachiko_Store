# 11. La app móvil

La app está en `mobile/`. Es un proyecto aparte (npm, no pnpm), hecho con **Expo SDK 58**:
React Native 0.88, expo-router y TanStack Query. **No tiene base de datos ni reglas de negocio
propias**: todo lo pide a la API v1 del mismo backend (`src/app/api/v1/`). Cómo levantarla en
un teléfono está en [manual-demo-telefono.md](../manual-demo-telefono.md).

## Estructura

```
mobile/src/
├── app/                 pantallas (expo-router: la carpeta es la ruta)
│   ├── (store)/         pestañas del cliente: Inicio, Buscar, Carrito, Cuenta
│   ├── (seller)/        pestañas del vendedor: Hoy, Despacho, Inventario, Más
│   ├── vendedor/        productos, categorías, carga masiva, escáner, pedido, stock por SKU
│   ├── producto/[slug]  ficha de producto
│   ├── login, pedidos, pedido-confirmado
│   └── _layout.tsx      fuentes, tema, caché de datos, sesión
├── lib/                 api.ts (cliente HTTP), session.ts, cart.ts, queries.ts, secure.ts
├── ui/                  componentes propios (NavBar, TextField, Pager, Fab, Snackbar…)
├── theme/               tokens de color y ThemeProvider (claro/oscuro)
└── features/catalog/    tarjeta de producto
```

## Dos modos en una sola app

- Un **cliente** ve las cuatro pestañas de la tienda.
- Un **vendedor** entra en modo trastienda: Hoy, Despacho, Inventario y Más. Desde Más puede
  "Ver la tienda" como la ven los clientes, y las vistas de inteligencia se abren en el
  navegador del teléfono.
- El layout `(seller)` redirige al inicio si el usuario no es SELLER. Esto es solo comodidad:
  **la seguridad real está en el servidor**, porque cada endpoint `/api/v1/seller/*` exige el rol.

## Sesión

[api.ts](../../mobile/src/lib/api.ts) y [secure.ts](../../mobile/src/lib/secure.ts):

- El **access token vive solo en memoria** (dura 15 minutos).
- El **refresh token se guarda en el llavero cifrado del sistema**: Keychain en iOS y Keystore
  en Android, vía `expo-secure-store` con `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, para que no
  viaje en los respaldos a otro dispositivo. En la vista previa web se usa `sessionStorage`,
  solo para desarrollo.
- Cada petición lleva `Authorization: Bearer <access>`. Si el servidor responde **401**, la app
  renueva **una sola vez** con el refresh token y reintenta. Si varias peticiones fallan a la
  vez, comparten la misma renovación.
- Si la renovación responde 401 (la sesión fue revocada), se borran los tokens y se vuelve al
  login. Si falla por falta de red, el refresh se conserva para intentar después.
- Como no usa cookies, la API v1 no es vulnerable a CSRF.

## Datos y caché

[_layout.tsx](../../mobile/src/app/_layout.tsx) configura TanStack Query pensando en el celular:

- Los datos se consideran frescos por 30 segundos y se guardan en caché 10 minutos.
- **Se reintenta solo ante cortes de red o errores 5xx**, con espera exponencial (máximo 8 s).
  Un 4xx no se reintenta, porque no se arregla repitiendo.
- Al volver la app al primer plano, se vuelven a consultar los datos.
- Las listas paginadas usan `keepPreviousData`: al cambiar de página no parpadean en blanco.
- El resumen "Hoy" del vendedor se actualiza solo cada 60 segundos.

## Carrito y pago

- El carrito se guarda en el teléfono (zustand con AsyncStorage). El precio guardado es solo
  para mostrarlo.
- **La app no procesa pagos.** "Pagar" abre en el navegador seguro del teléfono la página
  `/carrito/desde-app`, donde **el servidor pone los precios y revisa el stock**, y continúa con
  el checkout web (Webpay o Mercado Pago). Al terminar, el navegador vuelve a la pantalla
  `pedido-confirmado` de la app con un enlace profundo (`Linking.createURL`): `hachiko://` en
  la app instalada y `exp://` en Expo Go. Ver [03-compra.md](03-compra.md).

## Herramientas del vendedor

- **Escáner** de códigos con la cámara (`expo-camera`): Code 128, Code 39, EAN-13, EAN-8, UPC-A
  y QR. Lleva directo al stock del producto por SKU (`/api/v1/seller/products/by-code/[code]`).
- **Productos y categorías:** crear, editar, archivar y restaurar, con las mismas reglas que el
  panel web, porque usan los mismos módulos del servidor.
- **Carga masiva** desde el teléfono, con la misma revisión de archivos que la web.
- **Despacho:** preparar, despachar con número de seguimiento y marcar como entregado.

## Tema

`ThemeProvider` sigue el modo claro u oscuro del sistema, y el usuario puede fijarlo con el
interruptor de la app. La preferencia se guarda en AsyncStorage. Los colores salen de
[tokens.ts](../../mobile/src/theme/tokens.ts), con la misma paleta de la web.
