// Imprime el estado del dataset sintético en la BD, para docker-entrypoint.sh:
//   "no"     → no hay productos SYN-### (se genera por primera vez)
//   "stale"  → hay, pero el pedido sintético más nuevo tiene más de 3 días: los
//              paneles de "hoy / últimos 7 días" saldrían en $0, se regenera
//   "yes"    → hay y está al día (se omite)
//   "error"  → no se pudo consultar
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const STALE_MS = 3 * 86400000;

(async () => {
  const n = await db.product.count({ where: { sku: { startsWith: 'SYN-' } } });
  if (n === 0) return 'no';
  const last = await db.order.findFirst({
    where: { user: { email: { endsWith: '@seed.hachiko.test' } } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  return !last || Date.now() - last.createdAt.getTime() > STALE_MS ? 'stale' : 'yes';
})()
  .then((s) => process.stdout.write(s))
  .catch(() => process.stdout.write('error'))
  .finally(() => db.$disconnect());
