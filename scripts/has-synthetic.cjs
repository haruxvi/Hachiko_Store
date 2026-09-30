// Imprime "yes" si ya hay datos sintéticos (productos SYN-###) en la BD, "no" si
// no, "error" si no se pudo consultar. Lo usa docker-entrypoint.sh para generar
// el dataset sintético solo la primera vez (arranques posteriores lo omiten).
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
db.product
  .count({ where: { sku: { startsWith: 'SYN-' } } })
  .then((n) => process.stdout.write(n > 0 ? 'yes' : 'no'))
  .catch(() => process.stdout.write('error'))
  .finally(() => db.$disconnect());
