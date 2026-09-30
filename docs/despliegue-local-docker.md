# Despliegue local con Docker

Guía para levantar Hachiko **completo en tu PC** (app + base de datos) con un
solo comando, viendo la tienda en `http://localhost:3000`, sin exponer nada a la
red ni tocar la base de producción.

> Producción vive en **Vercel + Neon**. Este entorno es **local y aislado**: la
> app se conecta a un Postgres que corre en un contenedor en tu máquina, nunca a
> Neon. Lo que agregues o borres aquí **no afecta los datos reales**.

## Requisitos

- **Docker Desktop** (o Docker Engine) corriendo, con Docker Compose v2+.

Eso es todo: no necesitas Node ni pnpm en el host, corren dentro del contenedor.

## Levantar todo (un comando)

```bash
docker compose up --build
```

La primera vez construye la imagen (varios minutos) y genera los datos. Cada
arranque:

1. Levanta un **Postgres local** aislado (servicio `db`).
2. Sincroniza el esquema (`prisma db push`).
3. Carga datos base (categorías, productos y los usuarios de prueba).
4. **Solo la primera vez**, genera el dataset sintético completo (~24 meses:
   ~9.300 pedidos, 250 clientes, eventos de seguridad y analítica). En arranques
   posteriores lo detecta y lo omite, así el inicio es rápido.
5. Sirve la app en `http://localhost:3000`.

Cuando veas `✓ Ready`, abre <http://localhost:3000>. La tienda y el panel ya
quedan con datos: catálogo, pedidos por despachar, inventario, etc.

## Accesos

Los siguientes usuarios se crean en la **BD local** (credenciales de descarte,
**distintas de las de producción**):

| Rol | Dónde | Correo | Contraseña |
| --- | --- | --- | --- |
| Cliente | Tienda (`/`) | `cliente@hachiko.local` | `Cliente.Local2026` |
| Vendedor | Panel (`/trastienda`) | `vendedor@hachiko.local` | `Vendedor.Local2026` |

- Tienda: <http://localhost:3000>
- Panel vendedor: <http://localhost:3000/trastienda>
- Pago de prueba Webpay (integración): tarjeta VISA `4051 8856 0044 6623`,
  CVV `123`, cualquier fecha futura; RUT `11.111.111-1`, clave `123`.

> Estas contraseñas se definen en `docker-compose.yml` (variables
> `SEED_SELLER_PASSWORD` / `SEED_CLIENT_PASSWORD`). Cámbialas ahí si quieres.

## Comandos útiles

| Acción | Comando |
| --- | --- |
| Levantar (segundo plano) | `docker compose up -d --build` |
| Ver logs de la app | `docker compose logs -f app` |
| Detener (conserva los datos) | `docker compose down` |
| Detener y **borrar** la BD local | `docker compose down -v` |
| Reconstruir tras cambiar dependencias | `docker compose up --build` |
| Regenerar los datos sintéticos a mano | `docker compose exec app pnpm db:seed:synthetic` |
| Abrir una shell en el contenedor | `docker compose exec app sh` |

> Los tableros de **Inteligencia / Métricas** se nutren de tablas derivadas que
> calcula el pipeline de Python (en CI, no en la app). En local pueden aparecer
> vacíos o como *placeholder* aunque haya datos sintéticos; es esperado. Lo que
> sí se llena es lo operativo: catálogo, pedidos, inventario y seguridad.

## Subida de imágenes en local (opcional)

La subida de fotos usa Vercel Blob y necesita `BLOB_READ_WRITE_TOKEN`. En este
entorno local no se incluye, así que el botón "Subir foto" avisa que falta
configurarlo; **pegar una URL de imagen sí funciona**. Para habilitar la subida,
agrega la variable `BLOB_READ_WRITE_TOKEN` al servicio `app` en
`docker-compose.yml`.

## Por qué es seguro y aislado

- **No toca Neon.** La app apunta a `postgresql://…@db:5432/hachiko` (el
  contenedor local). Tu `.env` real —con Neon y tus secretos— está en
  `.dockerignore` y **no entra a la imagen**.
- **No expone tu IP.** El sitio se publica solo en `127.0.0.1:3000` (loopback),
  accesible únicamente desde tu PC. La BD no publica puertos: vive dentro de la
  red interna de Compose.
- **Secretos de descarte.** Las claves de `docker-compose.yml`
  (`JWT_SECRET`, `DATA_ENCRYPTION_KEY`, etc.) solo protegen esta base local; no
  son las de producción.
- **Transbank** usa el ambiente de **integración** (credenciales públicas de
  prueba, no mueven dinero real). Las de producción viven solo en Vercel.

## Alternativa sin contenedor para la app

Si prefieres correr solo la base en Docker y la app con `pnpm` en el host
(ciclo de recarga más rápido para desarrollar), puedes levantar únicamente el
Postgres y usar un `.env.local` propio:

```bash
docker compose up -d db
# luego, en el host, con tu .env.local apuntando a 127.0.0.1:5432:
pnpm install && pnpm exec prisma db push && pnpm db:seed && pnpm dev
```

Para esto tendrías que publicar el puerto del servicio `db` (agrega
`ports: ['127.0.0.1:5432:5432']` al servicio `db`).
