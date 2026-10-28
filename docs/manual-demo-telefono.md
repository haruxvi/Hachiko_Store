# Manual: probar Hachiko en tu casa (web y app en el teléfono)

Guía paso a paso para el **equipo** y la **comisión**. Al terminar tendrás, en tu
propio computador y sin tocar datos reales:

- la **tienda y el panel web** en `http://localhost:3000`;
- la **app** (tienda y trastienda) corriendo en tu teléfono, conectada a ese mismo
  servidor y con datos de prueba (catálogo, ~9.000 pedidos, clientes, avisos).

> **Es un entorno de prueba aislado.** Usa una base de datos propia dentro de
> Docker, nunca la de producción (Neon). Lo que crees, edites o borres aquí no
> afecta la tienda real.

**Tiempo:** unos 30 minutos la primera vez (la mayor parte es Docker construyendo
la imagen y cargando datos). Después, menos de un minuto.

---

## 1. Qué necesitas

### En el computador

| Programa | Para qué | Dónde |
|---|---|---|
| **Docker Desktop** | Corre el servidor y la base de datos | <https://www.docker.com/products/docker-desktop/> |
| **Node.js 20 o superior** (LTS) | Corre el script de la demo y Expo | <https://nodejs.org/> |
| **Git** | Descargar el proyecto | <https://git-scm.com/downloads> |

Funciona en **Windows 10/11** y **macOS**. Los comandos de este manual están para
PowerShell (Windows) y, cuando cambian, también para Terminal (macOS).

### En el teléfono

- **iPhone o Android** con la app **Expo Go** de la App Store o Google Play.
  Este proyecto usa el **SDK 58** de Expo (ver [Problemas frecuentes](#7-problemas-frecuentes)
  si Expo Go dice que el proyecto es incompatible).

### Una cuenta de Expo (gratis)

Desde el SDK 57, **Expo Go exige iniciar sesión en los dos lados**: en el
computador y en la app del teléfono, **con la misma cuenta**. Crea una en
<https://expo.dev/signup> (sirve entrar con GitHub o Google).

### Una red de confianza

El teléfono y el computador deben estar en **el mismo Wi-Fi**, y ese Wi-Fi debe
ser de confianza (tu casa o el hotspot de tu propio teléfono). Mientras la demo
corre, cualquiera en esa red puede abrir el sitio de prueba.
**No la uses en redes públicas, del trabajo o de la universidad.**

---

## 2. Preparar el computador (solo la primera vez)

### 2.1 Descargar el proyecto

```bash
git clone https://github.com/haruxvi/Hachiko_Store.git
cd Hachiko_Store
```

No hace falta instalar nada más: el script instala solo las dependencias de la
app la primera vez, y el servidor corre dentro de Docker.

### 2.2 Abrir Docker Desktop

Ábrelo y espera a que diga **"Engine running"** (el ícono de la ballena queda fijo).

### 2.3 Crear tu token de Expo

El computador necesita tu sesión de Expo. La forma más simple y confiable es un
**token de acceso**. Ojo: `npx expo login --browser` falla en Windows, así que no
lo uses.

1. Entra a <https://expo.dev> con tu cuenta.
2. Ve a **Settings → Access tokens → Create token**. Ponle un nombre como
   `demo-hachiko` y **cópialo**: solo se muestra una vez.
3. Guárdalo en tu computador como variable de entorno **de tu usuario**:

   **Windows (PowerShell):**
   ```powershell
   [Environment]::SetEnvironmentVariable('EXPO_TOKEN', 'PEGA_AQUÍ_TU_TOKEN', 'User')
   ```
   **macOS (Terminal):**
   ```bash
   echo 'export EXPO_TOKEN="PEGA_AQUÍ_TU_TOKEN"' >> ~/.zshrc
   ```
4. **Cierra y vuelve a abrir** la terminal (y VS Code, si lo usas). Las terminales
   abiertas no ven la variable nueva.

> El token es **personal**: no lo compartas ni lo subas al repositorio. Cuando ya
> no lo necesites, bórralo en expo.dev (Settings → Access tokens).

### 2.4 Dejar que el teléfono llegue al computador (Windows)

Windows bloquea por defecto las conexiones entrantes en redes "Públicas".

1. **Marca tu Wi-Fi como red privada:** Configuración → Red e Internet → Wi-Fi →
   (tu red) → **Tipo de perfil de red: Privada**.
2. **Firewall:** la primera vez que corras la demo, Windows preguntará si permite
   a **Node.js** y a **Docker** comunicarse. Marca **solo "Redes privadas"** y
   acepta. Si ya respondiste antes y no funciona, en PowerShell **como
   administrador**:
   ```powershell
   Get-NetFirewallRule -Direction Inbound | Where-Object DisplayName -in 'com.docker.backend.exe','Node.js JavaScript Runtime' | Set-NetFirewallRule -Profile Private
   ```

En **macOS** basta con aceptar el aviso "¿Permitir conexiones entrantes?" la
primera vez.

---

## 3. Preparar el teléfono

1. Instala **Expo Go** y **entra con la misma cuenta de Expo** (pestaña Home →
   ícono de perfil).
2. Conéctalo al **mismo Wi-Fi** que el computador.
3. **iPhone:**
   - Ajustes → Privacidad y seguridad → **Red local** → activa **Expo Go**.
   - Ajustes → Wi-Fi → apaga **Asistente de conectividad**. Si no, el iPhone puede
     irse por datos móviles cuando el Wi-Fi anda lento, y ahí no ve tu computador.
4. **Android:** si tienes "cambiar a datos móviles automáticamente", apágalo
   mientras pruebas.

---

## 4. Levantar todo

Desde la carpeta del proyecto:

```bash
node scripts/demo-lan.mjs
```

El script hace todo en orden y te va contando:

1. Detecta la IP de tu computador en el Wi-Fi (por ejemplo `192.168.1.86`).
2. Revisa que tengas sesión de Expo. Si falta el token, se detiene al instante y
   te dice qué hacer, **sin abrir nada a la red**.
3. Levanta Docker con datos de prueba. **La primera vez tarda varios minutos**:
   construye la imagen y genera ~24 meses de pedidos.
4. Cuando el sitio responde, muestra **"✔ Sitio listo"** y las cuentas de prueba.
5. Abre Expo y muestra un **código QR**.

### Escanear el QR

- **iPhone:** con la **cámara** normal, y toca el aviso para abrir en Expo Go.
- **Android:** desde la app **Expo Go** → "Scan QR code".

La primera carga en el teléfono tarda unos segundos (descarga la app desde tu
computador). Después, cada cambio en el código se refleja solo.

> En desarrollo, Expo Go muestra un **botón azul con un engranaje** flotando
> sobre la app. Es el menú de desarrollo, no parte de Hachiko: puedes arrastrarlo
> a un costado.

---

## 5. Entrar y probar

| Rol | Correo | Contraseña |
|---|---|---|
| **Vendedor** (trastienda) | `vendedor@hachiko.local` | `Vendedor.Local2026` |
| **Cliente** (tienda) | `cliente@hachiko.local` | `Cliente.Local2026` |

Estas cuentas existen **solo en el Docker local**; no sirven en la tienda real.

### Recorrido sugerido (10 minutos)

**Como cliente** (pestaña Cuenta → Iniciar sesión):
1. **Inicio:** saludo, categorías y lo nuevo en la vitrina.
2. **Buscar:** escribe "ramen"; usa los filtros, el orden y "Mostrar 12/24/48".
3. **Carrito:** agrega productos. El pago abre Webpay de **integración** (no mueve
   dinero real; datos de prueba en [Docker local](despliegue-local-docker.md#accesos)).
4. **Cuenta:** Mis pedidos, cambio de tema claro/noche y la sección **Legal y tus derechos**.

**Como vendedor** (cierra sesión y entra con la cuenta de vendedor):
1. **Hoy:** pedidos por empacar, ventas del día y avisos. Los avisos se pueden tocar.
2. **Pedidos:** por empacar y enviadas; toca uno para ver su ficha.
3. **Inventario:** filtra "Bajo el umbral" y ajusta el stock de un producto.
4. **Más → Catálogo:**
   - **Productos:** crea uno nuevo, edítalo, archívalo y usa **Deshacer**.
   - **Categorías:** crea una y ordénala.
   - **Carga masiva:** sube la plantilla Excel; primero ves la vista previa y
     nada se guarda hasta confirmar.

En el computador también puedes abrir la **web**: tienda en
<http://localhost:3000> y panel en <http://localhost:3000/trastienda>, con las
mismas cuentas.

---

## 6. Terminar

En la terminal donde corre la demo, presiona **Ctrl+C**. El script vuelve a dejar
el servidor visible **solo en tu computador** (ya no en el Wi-Fi).

| Quiero… | Comando |
|---|---|
| Apagar todo (conserva los datos) | `docker compose down` |
| Apagar y **borrar** los datos de prueba | `docker compose down -v` |
| Volver a empezar otro día | `node scripts/demo-lan.mjs` (ahora tarda menos de un minuto) |

---

## 7. Problemas frecuentes

| Lo que ves | Por qué pasa | Qué hacer |
|---|---|---|
| El script dice **"Expo Go exige sesión de Expo…"** | La terminal no tiene el token | Revisa el [paso 2.3](#23-crear-tu-token-de-expo) y **reabre la terminal** |
| En el teléfono, **"conexión expiró"** al escanear | El teléfono no llega al computador: va por datos móviles, el Wi-Fi está en "Público", el firewall bloquea o la red aísla equipos | 1) Confirma que el teléfono está en el **mismo Wi-Fi** y sin datos móviles. 2) Revisa el [paso 2.4](#24-dejar-que-el-teléfono-llegue-al-computador-windows). 3) Prueba en el navegador del teléfono `http://<IP que mostró el script>:8081/status`: si tampoco carga, la red aísla equipos → usa el **hotspot** del teléfono |
| Expo Go **pide iniciar sesión** al abrir el proyecto | Falta la sesión en la app o es otra cuenta | En Expo Go entra con **la misma cuenta** del token |
| **"Project is incompatible with this version of Expo Go"** | Tu Expo Go es de otro SDK (este proyecto usa el **58**) | iPhone: solo se puede tener la última versión de Expo Go; si la tienda ya pasó a un SDK nuevo, avísanos para actualizar el proyecto. Android: instala la versión para SDK 58 desde <https://expo.dev/go> |
| **"Docker no responde"** | Docker Desktop está cerrado o iniciando | Ábrelo, espera "Engine running" y repite |
| **"No encontré una IP de red local"** | El computador no está en un Wi-Fi | Conéctate al Wi-Fi (o al hotspot) y repite |
| El script muestra **otra IP** (por ejemplo de una VPN) | Hay varios adaptadores de red | Indícala a mano: `node scripts/demo-lan.mjs --ip=192.168.1.86` |
| **Ctrl+C no cierra** la demo | Expo quedó esperando | Cierra esa terminal y luego corre `docker compose up -d` para que el servidor vuelva a quedar solo en tu computador |
| Al subir una foto de producto: **"no tiene almacenamiento de fotos configurado"** | El entorno local no incluye Vercel Blob | Es normal en la demo: usa **"Pegar URL de una foto"** con una URL https |
| Los tableros de **Métricas** aparecen vacíos en la web | Se calculan con el pipeline de Python, que no corre en local | Es esperado ([detalle](despliegue-local-docker.md#comandos-útiles)) |

### Si el Wi-Fi no coopera: hotspot del teléfono

Redes de universidad, cafés o algunos routers aíslan a los equipos entre sí.
La salida más rápida es el hotspot de tu propio teléfono:

- **iPhone:** Ajustes → **Compartir Internet** (en otros idiomas, "Punto de acceso
  personal") → activar y encender **Maximizar compatibilidad**.
- **Android:** Ajustes → Redes → **Zona Wi-Fi / Punto de acceso**.

Conecta el computador a ese hotspot, márcalo como **red privada** (Windows) y
vuelve a correr `node scripts/demo-lan.mjs`. El script detecta la IP nueva solo.
Consume datos móviles del teléfono, pero la app gasta poco.

---

## 8. Seguridad (léelo una vez)

- **Nunca toca producción.** La demo usa un Postgres dentro de Docker con
  **claves de descarte**; tu `.env` real no entra a la imagen.
- **Solo en redes de confianza.** Mientras corre, el sitio de prueba queda
  visible en tu Wi-Fi. Al presionar Ctrl+C vuelve a quedar solo en tu computador.
- **Las cuentas de prueba son públicas** (están en este manual): no las uses
  fuera de esta demo.
- **Tu token de Expo es personal.** No lo pegues en chats ni en archivos del
  proyecto, y bórralo en expo.dev cuando termines.

Más detalle técnico del entorno en [Despliegue local con Docker](despliegue-local-docker.md).
