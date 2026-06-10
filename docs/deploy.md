# Guía de despliegue y entrega — Hachiko

Dos fases: **(1)** despliegue de prueba con TUS credenciales para validar todo el flujo en
producción real, y **(2)** entrega al cliente, donde se reemplazan TODAS las credenciales por
las suyas y se rotan los secretos.

> Regla de oro: ningún valor real se pega en el código ni se commitea. Los valores van en
> `.env` local (ignorado por git) y en **Vercel → Settings → Environment Variables**.

---

## FASE 1 — Despliegue de prueba (tus credenciales)

### 1.1 Genera los secretos propios de la app

En PowerShell, ejecuta esto **cuatro veces** (un valor distinto por secreto):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| Variable | Para qué sirve |
|---|---|
| `JWT_SECRET` | Firma de los tokens de sesión |
| `SESSION_SECRET` | Secreto de iron-session |
| `DATA_ENCRYPTION_KEY` | Cifrado AES-256-GCM de teléfonos/direcciones |
| `CRON_SECRET` | Autenticación de los crons de Vercel |

Guárdalos en un gestor de contraseñas. Los pegarás en el paso 1.5.

### 1.2 Neon (base de datos)

1. Crea cuenta en [neon.tech](https://neon.tech) → **New Project** (región AWS São Paulo es la
   más cercana a Chile) → Postgres 16.
2. En el dashboard del proyecto, **Connection string**:
   - Con **Pooled connection** activado → cópiala como `DATABASE_URL`.
   - Sin pooler (conexión directa) → cópiala como `DIRECT_URL`.
3. En tu máquina, crea `.env` en la raíz del proyecto (cópialo de `.env.example`) y pega ambas.
4. Crea las tablas y datos base:

```powershell
pnpm db:migrate      # crea la migración inicial y todas las tablas (incluye SecurityIncident)
pnpm db:seed         # categorías + 1 producto de ejemplo
```

5. El seed **no crea usuarios**. Para tener un vendedor de prueba: regístrate en la app
   (cuando esté desplegada) y luego promuévete con SQL en la consola de Neon
   (**SQL Editor**):

```sql
UPDATE "User" SET role = 'SELLER' WHERE email = 'tu-correo-de-prueba@gmail.com';
```

### 1.3 Mercado Pago (credenciales de PRUEBA)

1. Entra a [mercadopago.cl/developers](https://www.mercadopago.cl/developers) con tu cuenta →
   **Tus integraciones** → crea una aplicación.
2. En **Credenciales de prueba** copia:
   - `Access Token` → `MP_ACCESS_TOKEN`
   - `Public Key` → `MP_PUBLIC_KEY`
3. En **Webhooks** (configúralo DESPUÉS del primer deploy, necesitas la URL):
   - URL: `https://<tu-proyecto>.vercel.app/api/payments/mp/webhook`
   - Evento: Pagos.
   - Copia la **clave secreta** del webhook → `MP_WEBHOOK_SECRET`.
4. Para pagar usa las [tarjetas de prueba de MP](https://www.mercadopago.cl/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards)
   (ej.: Mastercard 5416 7526 0258 2580, cualquier CVV, vencimiento futuro).

> Nunca pidas ni uses las credenciales **productivas** de MP en esta fase: el dinero de
> ventas llega a la cuenta dueña de las credenciales.

### 1.4 Transbank (ambiente de integración)

No necesitas cuenta: el ambiente de integración de Webpay Plus usa credenciales públicas.

| Variable | Valor de prueba |
|---|---|
| `TBK_ENV` | `integration` |
| `TBK_COMMERCE_CODE` | `597055555532` (código público de integración Webpay Plus) |
| `TBK_API_KEY` | la API key pública de integración — está en la [documentación de Transbank Developers](https://www.transbankdevelopers.cl/documentacion/como_empezar#ambientes) |

Tarjeta de prueba Webpay: VISA `4051 8856 0044 6623`, CVV `123`, cualquier vencimiento;
RUT `11.111.111-1`, clave `123` en la simulación bancaria.

### 1.5 Resend (correos)

1. Cuenta gratuita en [resend.com](https://resend.com) → **API Keys** → crea una →
   `RESEND_API_KEY`.
2. Sin dominio verificado, Resend solo entrega a TU correo registrado y desde
   `onboarding@resend.dev`. Para la prueba pon:
   `EMAIL_FROM="Hachiko <onboarding@resend.dev>"` y prueba con tu propio correo.

### 1.6 Vercel (hosting + crons)

1. Sube el repo a GitHub (si no está) y en [vercel.com](https://vercel.com) → **Add New →
   Project** → importa el repo. Framework: Next.js (auto-detectado).
2. Antes del primer deploy, en **Settings → Environment Variables** (scope Production) pega
   TODO lo anterior:

| Variable | Origen |
|---|---|
| `DATABASE_URL` | Neon (pooled) — paso 1.2 |
| `DIRECT_URL` | Neon (directa) — paso 1.2 |
| `JWT_SECRET`, `SESSION_SECRET`, `DATA_ENCRYPTION_KEY`, `CRON_SECRET` | generados — paso 1.1 |
| `TBK_ENV`, `TBK_COMMERCE_CODE`, `TBK_API_KEY` | integración — paso 1.4 |
| `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET` | prueba — paso 1.3 |
| `RESEND_API_KEY`, `EMAIL_FROM` | paso 1.5 |
| `NEXT_PUBLIC_APP_URL` | `https://<tu-proyecto>.vercel.app` (la URL que te asigne Vercel) |

3. **Deploy**. Los crons de `vercel.json` (limpieza de reservas cada 5 min y anonimización
   de logs diaria) quedan activos automáticamente; Vercel les envía el header
   `Authorization: Bearer $CRON_SECRET`.
4. Vuelve al paso 1.3 y configura el webhook de MP con la URL real.

### 1.7 Checklist de validación end-to-end

- [ ] Registro de cliente y login (probar también 5 logins fallidos → bloqueo).
- [ ] Compra completa con Webpay de integración y con MP de prueba.
- [ ] Correo de confirmación de pedido llega (a tu correo de Resend).
- [ ] Webhook MP: el pedido pasa a PAID sin intervención manual.
- [ ] Trastienda como SELLER: dashboard, productos, inventario, despacho de orden.
- [ ] Panel **Seguridad**: los logins fallidos del primer punto aparecen en los KPIs;
      registrar una incidencia de prueba, agregar nota, exportar el informe JSON.
- [ ] Mi cuenta → exportar datos (ARCO) y solicitar eliminación.
- [ ] `/legal/privacidad` carga correctamente.

---

## FASE 2 — Entrega al cliente (reemplazo de credenciales)

### 2.1 Cuentas que el CLIENTE debe crear a su nombre

Estas no se transfieren: la titularidad importa legal y financieramente.

| Cuenta | Por qué debe ser suya |
|---|---|
| **Mercado Pago** (con su RUT y cuenta bancaria) | El dinero de ventas llega al titular. En su panel → Credenciales de **producción** → te pasa Access Token, Public Key y configura el webhook con secreto nuevo. |
| **Transbank** (contrato Webpay Plus a su razón social) | El `TBK_COMMERCE_CODE` productivo sale del contrato y los abonos van a su cuenta. `TBK_ENV="production"`. |
| **Vercel** | Facturación y dominio bajo su control. Crea cuenta y o bien le transfieres el proyecto (Settings → Transfer) o importas el repo en su cuenta (15 min). |
| **Neon** | La base con datos personales de SUS clientes debe estar bajo su titularidad (Ley 21.719: él es el responsable del tratamiento). Crear proyecto nuevo en su cuenta. |
| **Resend + dominio** (hachiko.cl) | Verificar el dominio en su cuenta de Resend para enviar desde `hola@hachiko.cl`. |

### 2.2 Qué se borra, qué se rota, qué se reemplaza

**Producción del cliente parte con base de datos NUEVA y VACÍA** (migraciones + seed sobre su
Neon). Los datos de tu fase de prueba no se migran: eran datos de prueba y se descartan
completos. Esto además permite rotar todo sin riesgo:

| Variable | Acción en la entrega |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Reemplazar por el Neon del cliente; correr `pnpm db:migrate:deploy` y `pnpm db:seed` contra ella |
| `JWT_SECRET`, `SESSION_SECRET`, `CRON_SECRET` | **Generar valores nuevos** (mismo comando del paso 1.1). Los tuyos quedan inservibles |
| `DATA_ENCRYPTION_KEY` | **Generar valor nuevo.** ⚠️ Solo es seguro porque la base parte vacía: esta llave cifra teléfonos/direcciones, y si se cambia con datos ya cifrados, esos datos quedan ilegibles para siempre. Una vez en producción real, NO se rota sin plan de re-cifrado |
| `MP_*` | Credenciales **productivas** de la cuenta MP del cliente + webhook reconfigurado |
| `TBK_ENV` | `production` |
| `TBK_COMMERCE_CODE` / `TBK_API_KEY` | Los del contrato Webpay del cliente |
| `RESEND_API_KEY` / `EMAIL_FROM` | API key de su cuenta + remitente del dominio verificado |
| `NEXT_PUBLIC_APP_URL` | `https://hachiko.cl` (dominio real apuntado en Vercel) |

Después del reemplazo:

- [ ] Borra tu proyecto de prueba en Vercel y tu base en Neon (o déjalos como staging si
      acuerdan mantener un ambiente de pruebas — en ese caso, que NUNCA tenga datos reales).
- [ ] Revoca tus credenciales de prueba de MP (basta con no usarlas; si quieres, elimina la
      aplicación en tu panel de developers).
- [ ] Elimina tu `.env` local con valores del cliente cuando termine el soporte, o guárdalo
      solo si el cliente te contrata mantenimiento (idealmente con acceso vía su equipo de
      Vercel, no con copias locales).
- [ ] El cliente crea SU usuario y lo promueve a SELLER (mismo SQL del paso 1.2, en su Neon).
- [ ] Repite el checklist 1.7 completo en producción, con una compra real de bajo monto
      con tarjeta real (y anúlala/reembólsala después como prueba de reversa).

### 2.3 Qué entregar junto con las llaves

- Acceso al repositorio (transferencia del repo o invitación como owner).
- Esta guía.
- El correo `contacto@hachiko.cl` operativo (aparece en la política de privacidad como canal
  para derechos ARCO — alguien tiene que leerlo).
- Recordatorio: la cuenta del panel de vendedor da acceso al módulo de Seguridad; ante un
  incidente, la incidencia se registra ahí y el informe exportado sirve de respaldo técnico
  para denunciar (PDI Cibercrimen / Fiscalía / Agencia de Protección de Datos).
