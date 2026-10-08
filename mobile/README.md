# Hachiko · App (Expo / React Native)

App para clientes y para el vendedor. Partimos con Android; el mismo código sirve después para iPhone.

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

1. Levanta la API local desde la raíz del repo:
   ```bash
   docker compose up -d
   ```
2. Ya existe `mobile/.env.local` con `EXPO_PUBLIC_API_URL=http://localhost:3000`, que apunta al Docker local. Sin ese archivo, la app usa la web publicada.
3. Arranca la app:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```
   - Vista previa en el navegador: tecla `w`.
   - En tu teléfono: escanea el QR con **Expo Go**. Para eso, `EXPO_PUBLIC_API_URL` tiene que apuntar a la IP de tu PC en la red local (por ejemplo `http://192.168.1.20:3000`), no a `localhost`.

Para instalar paquetes usa siempre `npx expo install <paquete>`, que elige versiones compatibles con el SDK 57.

## Probar en el emulador de Android Studio (con tu Docker local)

1. Abre un emulador en Android Studio (Device Manager → ▶).
2. Levanta la API local y la app:
   ```bash
   docker compose up -d
   ```
   ```bash
   cd mobile && npx expo start
   ```
3. En la terminal de Expo presiona `a`: instala Expo Go en el emulador y abre la app.

En el emulador, la app cambia sola `localhost` por `10.0.2.2`, que es como el emulador ve tu PC. Tu Docker sigue escuchando solo en `127.0.0.1`, sin exponerse a la red.

## Instalador APK (GitHub Actions)

El workflow está en `.github/workflows/android-apk.yml`:

- **Cada push a `app-nativa`** que toque `mobile/` genera un APK de prueba. Lo descargas en Actions → la corrida → **Artifacts**.
- **Un tag `app-v1.0.0`** (o cualquier `app-vX.Y.Z`) publica un **Release** con el APK firmado:
  ```bash
  git tag app-v1.0.0
  ```
  ```bash
  git push origin app-v1.0.0
  ```

El APK instalado se conecta a la web publicada. Antes de hacer merge a `master`, puedes apuntarlo a otra URL con la variable de repositorio `APP_API_URL`.

Para firmar, se necesitan 4 secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD`. Los firma el plugin `plugins/withReleaseSigning.js`. Guarda el archivo `.jks` en un lugar seguro y fuera del repo: si se pierde, las versiones nuevas no se pueden instalar encima de las anteriores.

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
    vendedor/   pedido, ajuste de stock, escáner
  ui/           componentes del sistema de diseño (solo tokens)
  theme/        tokens claro/noche (espejo de design-system/styles.css)
  lib/          API, sesión, carrito, consultas, formatos
  features/     piezas por dominio (tarjeta de producto)
```
