#!/bin/sh
# Arranque del contenedor de la app: sincroniza el esquema en la BD local, carga
# datos de demostración (idempotente, solo la primera vez lo pesado) y levanta
# el sitio. Pensado para "un solo comando": docker compose up --build.
set -e

echo "==> [1/4] Sincronizando el esquema en la BD local (prisma db push)..."
pnpm exec prisma db push --skip-generate

echo "==> [2/4] Cargando datos base (categorias, productos y usuarios)..."
pnpm exec tsx prisma/seed.ts || echo "   (seed base: los datos ya existian, se continua)"

echo "==> [3/4] Verificando dataset sintetico (operacion + analitica)..."
HAS_SYNTH=$(node scripts/has-synthetic.cjs 2>/dev/null || echo error)
if [ "$HAS_SYNTH" = "no" ]; then
  echo "    Generando ~24 meses de datos sinteticos (la primera vez tarda 1-3 min)..."
  pnpm exec tsx prisma/seed-synthetic.ts || echo "    (seed sintetico fallo, se continua)"
  pnpm exec tsx prisma/seed-security-events.ts || echo "    (seed seguridad omitido)"
  pnpm exec tsx prisma/seed-analytics-events.ts || echo "    (seed analitica omitido)"
else
  echo "    Datos sinteticos ya presentes ($HAS_SYNTH), se omite la regeneracion."
fi

echo "==> [4/4] Iniciando la aplicacion en http://localhost:3000 ..."
exec pnpm exec next dev -H 0.0.0.0 -p 3000
