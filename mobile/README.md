# Hachiko · App (Expo / React Native)

App para clientes y para el vendedor, para iPhone y Android con el mismo código.

- **Clientes:**
  - inicio y vitrina;
  - búsqueda con filtros;
  - ficha de producto con "se compran juntos";
  - carrito y pago;
  - mis pedidos con seguimiento;
  - cuenta, con tema claro/noche.
- **Vendedor (trastienda):**
  - "Hoy": por empacar, ventas y avisos;
  - pedidos por despachar, con ficha y botón para marcar como enviado;
  - inventario con ajuste de stock;
  - escáner de códigos;
  - catálogo: productos (con fotos), categorías y carga masiva desde la plantilla Excel;
  - accesos al panel web.

El diseño sale del sistema de diseño en [`design-system/`](design-system/README.md). Para verlo, abre `design-system/index.html`.

## Cómo funciona

| Tema | Detalle |
|---|---|
| Datos | API `/api/v1` del proyecto web (`src/app/api/v1`). Todo pasa por el mismo backend, la misma base y las mismas reglas que la web. |
| Sesión | El token de acceso dura 15 min y vive solo en memoria. El de renovación se guarda en el llavero cifrado del teléfono (`expo-secure-store`) y se renueva solo. Cerrar sesión lo revoca en todos los dispositivos. |
| Pago | El carrito se envía a la web (`/carrito/desde-app`). Allí el **servidor** pone el precio y revisa el stock, y el pago sigue con Webpay o Mercado Pago en el navegador seguro del sistema. Al terminar, la app vuelve sola con `hachiko://pedido-confirmado`. La app nunca maneja datos de tarjeta. |
| Caché | TanStack Query: reintenta ante cortes de red, se actualiza al volver a la app y permite tirar para recargar. |
| Carrito | Zustand + AsyncStorage: se mantiene aunque cierres la app. |

## Desarrollo

**En un teléfono real (lo más simple):** desde la raíz del repo, con el teléfono en el mismo Wi-Fi:

```bash
node scripts/demo-lan.mjs
```

Levanta el Docker local con datos de prueba (nunca toca Neon) y abre Expo ya apuntando a él.

Desde el SDK 57, Expo Go exige sesión de Expo en el computador **y** en la app, con la misma
cuenta. En el computador se usa un token en la variable `EXPO_TOKEN`; `expo login --browser` falla
en Windows. Requisitos, red, firewall y problemas frecuentes, paso a paso:
[Manual: probar Hachiko en tu casa](../docs/manual-demo-telefono.md).

**A mano (emulador o navegador):**

1. Levanta la API local desde la raíz del repo:
   ```bash
   docker compose up -d
   ```
2. Crea `mobile/.env.local` (no se sube a GitHub) con la URL de la API:
   - emulador Android: `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` (en el emulador, `localhost` es el propio emulador);
   - navegador del PC: `EXPO_PUBLIC_API_URL=http://localhost:3000`.

   Sin ese archivo, la app usa la web publicada (datos reales).
3. Arranca la app:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```
   - Emulador Android: tecla `a`. Navegador: tecla `w`.

Para instalar paquetes usa siempre `npx expo install <paquete>`, que elige versiones compatibles con el SDK 58.

## Verificación

```bash
npx tsc --noEmit && npx eslint src && npx expo-doctor
```

## Estructura

```
src/
  app/          rutas (Expo Router)
    (store)/    pestañas de la tienda: inicio, buscar, carrito, cuenta
    (seller)/   pestañas de la trastienda: hoy, despacho, inventario, más
    producto/   ficha de producto
    vendedor/   pedido, ajuste de stock, escáner, productos, categorías, carga masiva
  ui/           componentes del sistema de diseño (solo tokens)
  theme/        tokens claro/noche (espejo de design-system/styles.css)
  lib/          API, sesión, carrito, consultas, formatos
  features/     piezas por dominio (tarjeta de producto)
```
