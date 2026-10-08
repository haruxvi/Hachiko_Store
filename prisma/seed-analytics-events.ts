/**
 * Eventos de comportamiento SINTÉTICOS en AnalyticsEvent (Fase 4).
 *
 * Genera sesiones con un embudo realista (vista → producto → carrito →
 * checkout → abandono) y búsquedas, algunas sin resultado (demanda
 * insatisfecha). Es la materia prima del embudo de conversión, la
 * recuperación de carritos y el análisis de búsquedas sin resultado.
 *
 * Idempotente: borra los eventos sintéticos previos (metadata.synthetic=true)
 * y regenera. Solo perfila datos de comportamiento anónimos/agregados
 * (Ley 21.719). Ejecutar:  pnpm db:seed:analytics
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { randomUUID, randomInt } from 'node:crypto';

const db = new PrismaClient({ datasourceUrl: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'] });

const USER_MARK = '@seed.hachiko.test';
// Ventana del embudo (la misma que muestra el panel de Conversión).
const WINDOW_DAYS = 30;
// Probabilidades por etapa, en línea con un e-commerce real (~2–3% de las
// visitas que ven un producto terminan comprando).
const P_CART = 0.09; // vio un producto → agregó al carrito
const P_CHECKOUT = 0.5; // carrito → inició el checkout
const P_ABANDON = 0.45; // checkout → lo abandonó
const CONVERSION = P_CART * P_CHECKOUT * (1 - P_ABANDON);
// Búsquedas sin resultado = demanda insatisfecha (productos que no tienes).
const MISSES = ['matcha', 'labubu', 'hello kitty', 'stanley cup', 'ramune', 'mochi', 'funko', 'airpods', 'sanrio', 'jellycat'];

// Randomness criptográfico (node:crypto) — evita el PRNG débil de Math.random
// en datos que fluyen a campos de sesión/seguridad (CWE-338).
const randInt = (a: number, b: number) => randomInt(a, b + 1);
const rnd = () => randomInt(0, 1_000_000) / 1_000_000; // float en [0,1)
const pick = <T>(arr: T[]): T => arr[randomInt(arr.length)]!;
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000 - randInt(0, 23) * 3600000);
const SYN = { synthetic: true } as Prisma.InputJsonValue;

async function main() {
  console.log('Limpiando eventos de comportamiento sintéticos previos…');
  await db.analyticsEvent.deleteMany({ where: { metadata: { path: ['synthetic'], equals: true } } });

  const [users, products] = await Promise.all([
    db.user.findMany({ where: { email: { endsWith: USER_MARK } }, select: { id: true } }),
    db.product.findMany({ where: { sku: { startsWith: 'SYN-' } }, select: { id: true, slug: true } }),
  ]);
  if (products.length === 0) {
    console.log('No hay productos sintéticos. Corre primero pnpm db:seed:synthetic.');
    return;
  }
  const uids = users.map((u) => u.id);
  const rows: Prisma.AnalyticsEventCreateManyInput[] = [];

  // Cuántas visitas hacen falta para explicar los pedidos de la ventana con una
  // conversión realista: así el embudo cuadra con las ventas de la tienda.
  const orders = await db.order.count({
    where: { createdAt: { gte: new Date(Date.now() - WINDOW_DAYS * 86400000) }, user: { email: { endsWith: USER_MARK } } },
  });
  const nSessions = Math.max(1500, Math.round(orders / CONVERSION));

  for (let s = 0; s < nSessions; s++) {
    const sid = randomUUID();
    // La mayoría navega sin iniciar sesión.
    const uid = rnd() < 0.3 && uids.length ? pick(uids) : null;
    const t0 = daysAgo(randInt(0, WINDOW_DAYS - 1));
    let t = t0.getTime();
    const step = () => new Date((t += randInt(20, 240) * 1000));
    const base = { sessionId: sid, userId: uid, metadata: SYN };

    rows.push({ ...base, type: 'PAGE_VIEW', path: '/', createdAt: step() });

    // Búsquedas (35%), algunas sin resultado
    if (rnd() < 0.35) {
      const noResult = rnd() < 0.22;
      rows.push({
        ...base, type: 'SEARCH', createdAt: step(),
        query: noResult ? pick(MISSES) : pick(products).slug.replace('syn-', '').replace(/-/g, ' '),
        metadata: { synthetic: true, results: noResult ? 0 : randInt(1, 8) } as Prisma.InputJsonValue,
      });
    }

    // Vistas de producto
    const views = randInt(1, 4);
    const seen = new Set<string>();
    for (let v = 0; v < views; v++) {
      const p = pick(products);
      seen.add(p.id);
      rows.push({ ...base, type: 'PRODUCT_VIEW', productId: p.id, path: `/producto/${p.slug}`, createdAt: step() });
    }

    // Embudo: carrito → checkout → abandono/compra
    if (rnd() < P_CART) {
      const p = pick([...seen]);
      rows.push({ ...base, type: 'ADD_TO_CART', productId: p, createdAt: step() });
      if (rnd() < P_CHECKOUT) {
        rows.push({ ...base, type: 'CHECKOUT_START', createdAt: step() });
        if (rnd() < P_ABANDON) {
          rows.push({ ...base, type: 'CHECKOUT_ABANDON', createdAt: step() });
        }
      } else if (rnd() < 0.3) {
        rows.push({ ...base, type: 'REMOVE_FROM_CART', productId: p, createdAt: step() });
      }
    }
  }

  for (let i = 0; i < rows.length; i += 500) {
    await db.analyticsEvent.createMany({ data: rows.slice(i, i + 500) });
  }
  console.log(`AnalyticsEvent: ${rows.length} eventos en ${nSessions} sesiones (${WINDOW_DAYS} días, conversión esperada ${(CONVERSION * 100).toFixed(1)}%).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
