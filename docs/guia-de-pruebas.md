# Guía paso a paso para probar Hachiko desplegada

Guía de pruebas funcionales del sitio en Vercel: vista de **cliente**, vista de **vendedor**,
doble factor (2FA), panel de seguridad y derechos de datos. Complementa a `docs/deploy.md`
(que cubre cómo desplegar); esta guía cubre **qué probar y en qué orden** una vez arriba.

---

## 0. Antes de empezar

### 0.1 Modelo de roles (qué deberías ver con cada cuenta)

| | CLIENT (cliente) | SELLER (vendedor) |
|---|---|---|
| Catálogo, carrito, checkout | ✔ | ✔ |
| Mis pedidos, mi perfil, mis datos (ARCO) | ✔ | ✔ |
| Trastienda (dashboard, productos, categorías, inventario, órdenes) | ✘ (redirige a /login) | ✔ |
| Panel Seguridad e incidencias | ✘ | ✔ |
| Acceso de "superusuario" / a datos de otros usuarios | ✘ | ✘ — no existe ese rol |

No hay rol ADMIN: el modelo es de **mínimo privilegio** con dos roles. El vendedor opera la
tienda pero no puede leer contraseñas (hasheadas con Argon2) ni teléfonos/direcciones en
claro fuera de lo necesario para despachar.

### 0.2 Usuarios de prueba — dónde poner las credenciales

Las credenciales **no están en el código**. El seed las lee de variables de entorno y solo
crea los usuarios si están definidas:

1. En tu `.env` local (el mismo que apunta a tu Neon de prueba) agrega:

```dotenv
SEED_SELLER_EMAIL="<correo del vendedor de prueba>"
SEED_SELLER_PASSWORD="<contraseña del vendedor>"
SEED_CLIENT_EMAIL="<correo del cliente de prueba>"
SEED_CLIENT_PASSWORD="<contraseña del cliente>"
```

2. Ejecuta `pnpm db:seed`. Verás `Seeded SELLER de prueba: ...` y `Seeded CLIENT de prueba: ...`.
3. Las contraseñas concretas guárdalas en tu gestor de contraseñas (no en el repo, no en
   un archivo del proyecto). Reglas mínimas: 8+ caracteres, una mayúscula, un número.

> En la entrega al cliente estas 4 variables NO se configuran: producción parte sin
> usuarios de prueba. Si los creaste en una base que pasará a producción (no recomendado),
> elimínalos antes.

### 0.3 Requisitos

- El sitio desplegado en Vercel con todas las variables de `docs/deploy.md` (fase 1).
- Un teléfono con una app de autenticación (Google Authenticator, Microsoft
  Authenticator o Authy) para probar el 2FA.
- Tarjetas de prueba a mano: VISA Webpay `4051 8856 0044 6623` (CVV 123, RUT 11.111.111-1,
  clave 123) y Mastercard MP `5416 7526 0258 2580`.

---

## 1. Vista pública (sin sesión)

1. Abre la URL del deploy. Debes ver el home con header (Catálogo, Carrito, **Iniciar
   sesión**), hero, categorías del seed (Snacks, Skincare, Papelería, K-pop) y footer con
   los enlaces legales.
2. Entra a **/legal/privacidad**: debe cargar la política completa (versión y fecha al inicio).
3. Navega al **Catálogo** → abre el producto de ejemplo (Pepero) → agrégalo al carrito.
4. Intenta entrar a `/trastienda` directamente: debe **redirigirte a /login** (no debe
   mostrar nada del panel).
5. Intenta `/perfil`: igual, redirección a /login.

Resultado esperado: nada del panel ni de cuentas es visible sin sesión.

## 2. Vista de CLIENTE

### 2.1 Login y perfil

1. En **/login** ingresa las credenciales del cliente de prueba → te deja en el home, y el
   header ahora muestra **Mi cuenta** (y NO muestra "Trastienda").
2. Entra a **Mi cuenta** (/perfil): datos de la cuenta, sección 2FA (inactivo), enlace a
   gestión de datos. Verifica que diga "cuenta de cliente".
3. Prueba el login fallido: cierra sesión, intenta entrar con contraseña mala 2 veces.
   Mensaje genérico "Credenciales inválidas" (no debe revelar si el correo existe).

### 2.2 Doble factor (2FA)

1. Con sesión de cliente, en /perfil → **Activar doble factor**.
2. Escanea el QR con tu app de autenticación → ingresa el código de 6 dígitos → estado
   pasa a **Activo**.
3. Cierra sesión y vuelve a entrar: tras email+contraseña correctos, el formulario pide el
   **código de verificación**. Pruébalo primero con un código inventado (debe fallar) y
   luego con el real (debe entrar).
4. (Opcional) Desactiva el 2FA desde /perfil — exige un código vigente — y reactívalo.

### 2.3 Compra completa

1. Con el producto en el carrito → **Checkout**: completa la dirección chilena (teléfono
   formato +56 9 XXXX XXXX).
2. Paga con **Webpay** (integración) usando la VISA de prueba. Debes volver al sitio con la
   orden confirmada.
3. Repite con otra orden pagando con **Mercado Pago** (tarjetas de prueba MP).
4. Revisa **Mis pedidos**: ambas órdenes con estado PAGADO.
5. Si configuraste Resend: el correo de confirmación llega (en sandbox, solo al correo
   dueño de la cuenta Resend).

### 2.4 Derechos de datos (Ley 21.719)

1. /perfil → Gestión de datos → **Exportar mis datos**: descarga un JSON con cuenta,
   direcciones y pedidos (teléfono/dirección descifrados solo para el titular).
2. NO pruebes "Eliminar cuenta" con el usuario que sigas usando — si quieres probarlo,
   regístrate antes con un segundo correo desechable en **/registro** (verifica de paso que
   el registro exige aceptar la política de privacidad) y elimina ESA cuenta.

Resultado esperado: el cliente puede comprar y gestionar SUS datos; nunca ve la trastienda.

## 3. Vista de VENDEDOR

### 3.1 Login y alcance

1. Cierra la sesión de cliente. Entra con las credenciales del vendedor → te redirige
   directo a **/trastienda**.
2. Activa también el **2FA del vendedor** (misma mecánica desde /perfil). Para la cuenta
   que opera la tienda el doble factor no es opcional: es la cuenta más sensible.
3. Recorre el sidebar: Dashboard, Órdenes para despachar, Productos, Categorías,
   Inventario, **Seguridad**.

### 3.2 Operación de tienda

1. **Dashboard**: KPIs de ventas reflejan las compras que hiciste como cliente.
2. **Productos**: crea un producto nuevo (categoría, precio, stock, peso) → verifica que
   aparece en el catálogo público. Archívalo → desaparece del catálogo (no se borra:
   queda en "Archivados").
3. **Inventario**: ajusta el stock del Pepero (motivo "Corrección" exige nota) → revisa el
   **histórico** del producto: el movimiento queda registrado con stock anterior/resultante.
4. **Órdenes**: despacha una de tus órdenes pagadas ingresando un número de seguimiento.
   Como cliente, verifica en Mis pedidos que aparece "enviado" + tracking.

### 3.3 Panel de Seguridad e incidencias

1. **KPIs de monitoreo**: los logins fallidos que provocaste en 2.1/2.2 deben aparecer en
   "Logins fallidos (24 h)" y los eventos en la tabla derecha con su IP.
2. **Registrar incidencia**: crea una de prueba (ej. categoría "Abuso de credenciales",
   severidad Media, descripción de los intentos fallidos). Verifica que la bitácora parte
   con el evento "Registro" sellado con hash y el badge **"Integridad verificada"**.
3. Agrega una **nota** y un cambio de estado a "En investigación" (exige justificación).
4. **Exportar informe para autoridad**: descarga el JSON y revisa que incluye la ficha, la
   bitácora completa con la cadena de hashes y el `selloDocumento`.
5. Verifica el flujo de denuncia manual: pestaña "Registrar denuncia" (autoridad +
   N° de referencia). Nada se envía automáticamente a nadie: solo documenta.

### 3.4 Límites del vendedor (prueba negativa)

1. Como vendedor NO debe existir ninguna vista que liste clientes con teléfonos o
   direcciones en claro fuera de la orden a despachar.
2. Forzar URLs de otro rol no aplica (no hay rutas de admin). Prueba `/api/security/incidents/<id>/export`
   con la sesión de CLIENTE (pegando la URL logueado como cliente): debe responder 403.

Resultado esperado: el vendedor opera tienda + seguridad, sin superpoderes sobre datos personales.

## 4. Pruebas de seguridad transversales

1. **Bloqueo de cuenta**: con un usuario desechable, falla la contraseña 5 veces → el 6.º
   intento (aunque sea correcto) debe responder "Cuenta bloqueada temporalmente" (15 min).
   El evento "Cuenta bloqueada" aparece en el panel de Seguridad.
2. **Rate limiting**: una ráfaga de logins (>10/min desde tu IP) devuelve 429.
3. **Cookies**: en DevTools → Application → Cookies, `hachiko_access` y `hachiko_refresh`
   deben ser `HttpOnly`, `Secure` y `SameSite=Strict`.
4. **Crons**: en Vercel → Settings → Cron Jobs deben figurar `clean-reservations` (cada
   5 min) y `clean-audit-logs` (diario 4:00). Llamar la URL del cron sin el header
   `Authorization` debe dar 401.

## 5. Registro de lo probado

Para el traspaso, deja constancia: fecha, versión desplegada (hash del commit), checklist
de esta guía con ✔/✘ y pantallazos de (a) compra confirmada, (b) incidencia con integridad
verificada, (c) export ARCO. Eso te sirve como evidencia de QA ante tu cliente.

---

## Apéndice — problemas comunes

| Síntoma | Causa probable |
|---|---|
| Login correcto pero vuelve a /login | Cookies `Secure` sin HTTPS — usa la URL https de Vercel, no http |
| "Código de autenticación inválido" con código correcto | Reloj del teléfono desfasado >1 min — activa hora automática |
| Webhook MP no confirma la orden | URL del webhook mal configurada o `MP_WEBHOOK_SECRET` distinto al del panel MP |
| Correos no llegan | Resend en sandbox solo entrega al correo dueño de la cuenta |
| El seed no creó usuarios | Variables `SEED_*` no definidas en el `.env` al momento de correr `pnpm db:seed` |
