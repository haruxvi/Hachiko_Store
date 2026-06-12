# Despliegue local con Docker

Guía para levantar Hachiko en una máquina de desarrollo y ver la página en
`http://localhost:3000`, sin exponer nada a la red ni comprometer credenciales.

## Requisitos

- Docker Desktop (o Docker Engine) corriendo
- Node.js ≥ 20 y pnpm ≥ 9 (`corepack enable` lo instala)

## 1 · Base de datos PostgreSQL en Docker

```powershell
docker run -d --name hachiko-pg `
  --restart unless-stopped `
  -e POSTGRES_USER=hachiko `
  -e POSTGRES_PASSWORD=<contraseña-local> `
  -e POSTGRES_DB=hachiko `
  -p 127.0.0.1:5433:5432 `
  -v hachiko_pgdata:/var/lib/postgresql/data `
  postgres:16
```

Puntos de seguridad de este comando:

- **`-p 127.0.0.1:5433:5432`** liga el puerto solo a localhost. Sin el prefijo
  `127.0.0.1:` Docker publica en todas las interfaces y la base queda visible
  para cualquier equipo de tu red local. No lo omitas.
- La contraseña es local y no viaja a ningún repositorio; aún así usa una
  generada al azar, no `123456`.
- El volumen `hachiko_pgdata` conserva los datos entre reinicios
  (`docker start hachiko-pg` después de reiniciar el PC).

## 2 · Variables de entorno

Copia la plantilla y complétala. El archivo `.env.local` está en `.gitignore`:
**nunca lo agregues al repositorio ni lo compartas**.

```powershell
Copy-Item .env.example .env.local
```

Genera los secretos con un RNG criptográfico (PowerShell):

```powershell
function New-Hex([int]$n) { $b = New-Object byte[] $n; [System.Security.Cryptography.RandomNumberGenerator]::Fill($b); [Convert]::ToHexString($b).ToLower() }
"JWT_SECRET=$(New-Hex 32)"
"SESSION_SECRET=$(New-Hex 32)"
"DATA_ENCRYPTION_KEY=$(New-Hex 32)"   # debe quedar de 64 caracteres hex exactos
"CRON_SECRET=$(New-Hex 16)"
```

Valores mínimos del `.env.local`:

```ini
DATABASE_URL="postgresql://hachiko:<contraseña-local>@localhost:5433/hachiko"
DIRECT_URL="postgresql://hachiko:<contraseña-local>@localhost:5433/hachiko"

JWT_SECRET="<generado>"
SESSION_SECRET="<generado>"
DATA_ENCRYPTION_KEY="<generado, 64 hex>"
CRON_SECRET="<generado>"

# Transbank — ambiente de INTEGRACIÓN. Estas credenciales son públicas y
# oficiales de prueba (publicadas por Transbank); no mueven dinero real.
TBK_ENV="integration"
TBK_COMMERCE_CODE="597055555532"
TBK_API_KEY="579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C"

# MercadoPago: usa las credenciales de PRUEBA de tu propia cuenta
# (panel de desarrolladores → credenciales de test). Con placeholders la
# opción MercadoPago del checkout falla; Webpay funciona igual.
MP_ACCESS_TOKEN="TEST-..."
MP_PUBLIC_KEY="TEST-..."
MP_WEBHOOK_SECRET="<cualquier-valor-local>"

# Resend: opcional en local. Sin una API key real no se envían correos
# (verificación de email, confirmaciones), el resto de la app funciona.
RESEND_API_KEY="re_placeholder"

NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Usuarios de prueba (opcional). El seed SOLO los crea si defines estas
# variables; elige contraseñas aleatorias, son cuentas reales en tu BD local.
SEED_SELLER_EMAIL="vendedor@hachiko.local"
SEED_SELLER_PASSWORD="<elige-una>"
SEED_CLIENT_EMAIL="cliente@hachiko.local"
SEED_CLIENT_PASSWORD="<elige-una>"
```

## 3 · Instalar, crear el esquema y poblar

```powershell
pnpm install
pnpm db:generate          # genera el cliente Prisma
pnpm exec prisma db push  # crea las tablas (el repo no versiona migraciones)
pnpm db:seed              # categorías, producto demo y usuarios de prueba
```

## 4 · Levantar el sitio

```powershell
pnpm dev
```

- Tienda: <http://localhost:3000>
- Panel vendedor: <http://localhost:3000/trastienda> (inicia sesión con el
  usuario SELLER del seed)
- Pago de prueba Webpay (integración): tarjeta VISA `4051 8856 0044 6623`,
  CVV `123`, cualquier fecha futura; RUT `11.111.111-1`, clave `123`.

## Comandos útiles

| Acción | Comando |
| --- | --- |
| Parar / arrancar la base | `docker stop hachiko-pg` / `docker start hachiko-pg` |
| Ver datos con Prisma Studio | `pnpm db:studio` |
| Build de producción local | `pnpm build && pnpm start` |
| Typecheck / lint / tests | `pnpm typecheck` / `pnpm lint` / `pnpm test` |

## Notas de seguridad

- `.env.local` y cualquier `.env*` están en `.gitignore`. Verifica con
  `git status` antes de commitear: ningún secreto debe aparecer.
- La CSP del sitio permite `'unsafe-eval'` **solo en desarrollo** (lo exige el
  runtime de webpack de `next dev`); la política de producción es estricta y
  no se modifica.
- No publiques el puerto 3000 ni el 5433 fuera de localhost. Si necesitas
  mostrar la página a otra persona, usa un túnel autenticado en vez de abrir
  puertos en el router.
- Las credenciales de Transbank de integración son públicas; las de
  **producción** (comercio real) van únicamente en el entorno del servidor de
  producción, jamás en archivos del repo.
