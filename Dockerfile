# Imagen LOCAL de desarrollo para Hachiko Store.
# NO es la imagen de producción: producción vive en Vercel. Esto sirve para
# correr todo en tu PC contra una base Postgres local y aislada (ver
# docker-compose.yml), sin tocar Neon ni exponer tu IP.
FROM node:20-slim

# openssl: lo requiere el motor de consultas de Prisma en Debian.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable

# Capa cacheable de dependencias. Se copia prisma/ antes del install porque el
# postinstall ejecuta `prisma generate` y necesita el schema.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# Resto del código de la app.
COPY . .

# Normaliza fin de línea del entrypoint (por si se editó en Windows con CRLF)
# y lo hace ejecutable.
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
