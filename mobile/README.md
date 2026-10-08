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
