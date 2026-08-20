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
import { randomUUID } from 'node:crypto';

const db = new PrismaClient({ datasourceUrl: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'] });

const USER_MARK = '@seed.hachiko.test';
const N_SESSIONS = 3500;
// Búsquedas sin resultado = demanda insatisfecha (productos que no tienes).
const MISSES = ['matcha', 'labubu', 'hello kitty', 'stanley cup', 'ramune', 'mochi', 'funko', 'airpods', 'sanrio', 'jellycat'];

const randInt = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
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

  for (let s = 0; s < N_SESSIONS; s++) {
    const sid = randomUUID();
    const uid = Math.random() < 0.6 && uids.length ? pick(uids) : null;
    const t0 = daysAgo(randInt(0, 120));
    let t = t0.getTime();
    const step = () => new Date((t += randInt(20, 240) * 1000));
    const base = { sessionId: sid, userId: uid, metadata: SYN };

    rows.push({ ...base, type: 'PAGE_VIEW', path: '/', createdAt: step() });

    // Búsquedas (35%), algunas sin resultado
    if (Math.random() < 0.35) {
      const noResult = Math.random() < 0.22;
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
    if (Math.random() < 0.32) {
      const p = pick([...seen]);
      rows.push({ ...base, type: 'ADD_TO_CART', productId: p, createdAt: step() });
      if (Math.random() < 0.55) {
        rows.push({ ...base, type: 'CHECKOUT_START', createdAt: step() });
        if (Math.random() < 0.4) {
          rows.push({ ...base, type: 'CHECKOUT_ABANDON', createdAt: step() });
        }
      } else if (Math.random() < 0.3) {
        rows.push({ ...base, type: 'REMOVE_FROM_CART', productId: p, createdAt: step() });
      }
    }
  }

  for (let i = 0; i < rows.length; i += 500) {
    await db.analyticsEvent.createMany({ data: rows.slice(i, i + 500) });
  }
  console.log(`AnalyticsEvent: ${rows.length} eventos en ${N_SESSIONS} sesiones.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
