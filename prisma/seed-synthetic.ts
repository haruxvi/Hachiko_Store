/**
 * Dataset SINTÉTICO para el subsistema de análisis de datos y ML (Fase 0).
 *
 * Genera ~24 meses de historia comercial coherente en Neon, con estacionalidad
 * realista (18 de septiembre, Navidad, CyberDay), tendencia de crecimiento,
 * afinidad de canasta ("se compran juntos"), geografía chilena, movimientos de
 * inventario y bitácora temporal de estados de pedido. Es el combustible de
 * todos los modelos de las fases siguientes.
 *
 * Se escribe a Neon con el cliente Prisma (misma conexión del .env), igual que
 * prisma/seed.ts. Los datos van marcados como sintéticos:
 *   - usuarios con email  @seed.hachiko.test
 *   - productos con SKU   SYN-###
 * Re-ejecutar el script BORRA primero todo lo sintético anterior y regenera,
 * sin tocar datos reales. Ejecutar con:  pnpm db:seed:synthetic
 */
import { PrismaClient, type Prisma, type OrderStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';

// Carga masiva: usa la conexión DIRECTA (no pooled) para evitar límites del
// pooler serverless de Neon en inserciones grandes.
const db = new PrismaClient({
  datasourceUrl: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
});

// ── Marcadores y parámetros ──────────────────────────────────────────────
const USER_MARK = '@seed.hachiko.test';
const SKU_PREFIX = 'SYN-';
const MONTHS = 24;
const N_CUSTOMERS = 250;
const BASE_ORDERS_PER_DAY = 8; // media; se multiplica por estacionalidad/tendencia
const RNG_SEED = 20260820;

// ── PRNG determinista (mulberry32) para que el dataset sea reproducible ───
let _s = RNG_SEED >>> 0;
function rnd(): number {
  _s |= 0;
  _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const id = () => randomUUID();

// ── Catálogo sintético (con costCLP para analítica de márgenes) ───────────
type Cat = 'snacks' | 'skincare' | 'papeleria' | 'kpop';
interface P { sku: string; slug: string; name: string; cat: Cat; price: number; cost: number; weight: number }
const CATALOG: P[] = [
  { sku: 'SYN-001', slug: 'syn-pepero-choco', name: 'Pepero Chocolate', cat: 'snacks', price: 1990, cost: 1200, weight: 60 },
  { sku: 'SYN-002', slug: 'syn-pepero-almendra', name: 'Pepero Almendra', cat: 'snacks', price: 2190, cost: 1300, weight: 60 },
  { sku: 'SYN-003', slug: 'syn-choco-pie', name: 'Choco Pie (caja)', cat: 'snacks', price: 3990, cost: 2500, weight: 300 },
  { sku: 'SYN-004', slug: 'syn-ramen-shin', name: 'Ramen Shin Picante', cat: 'snacks', price: 1490, cost: 850, weight: 120 },
  { sku: 'SYN-005', slug: 'syn-ramen-buldak', name: 'Ramen Buldak 2x', cat: 'snacks', price: 2990, cost: 1800, weight: 280 },
  { sku: 'SYN-006', slug: 'syn-banana-milk', name: 'Banana Milk', cat: 'snacks', price: 1690, cost: 1000, weight: 240 },
  { sku: 'SYN-007', slug: 'syn-honey-butter-chips', name: 'Honey Butter Chips', cat: 'snacks', price: 2490, cost: 1500, weight: 60 },
  { sku: 'SYN-008', slug: 'syn-gummy-tape', name: 'Gomitas Cinta', cat: 'snacks', price: 1290, cost: 700, weight: 40 },
  { sku: 'SYN-010', slug: 'syn-sheet-mask-aloe', name: 'Mascarilla Aloe', cat: 'skincare', price: 1990, cost: 900, weight: 30 },
  { sku: 'SYN-011', slug: 'syn-sheet-mask-snail', name: 'Mascarilla Caracol', cat: 'skincare', price: 2490, cost: 1100, weight: 30 },
  { sku: 'SYN-012', slug: 'syn-toner-verde', name: 'Tónico Té Verde', cat: 'skincare', price: 8990, cost: 5200, weight: 200 },
  { sku: 'SYN-013', slug: 'syn-serum-vitc', name: 'Serum Vitamina C', cat: 'skincare', price: 12990, cost: 7500, weight: 80 },
  { sku: 'SYN-014', slug: 'syn-crema-snail', name: 'Crema Caracol', cat: 'skincare', price: 14990, cost: 8800, weight: 120 },
  { sku: 'SYN-015', slug: 'syn-protector-solar', name: 'Protector Solar SPF50', cat: 'skincare', price: 9990, cost: 5800, weight: 100 },
  { sku: 'SYN-016', slug: 'syn-lip-tint', name: 'Lip Tint Coreano', cat: 'skincare', price: 6990, cost: 3900, weight: 20 },
  { sku: 'SYN-020', slug: 'syn-cuaderno-molang', name: 'Cuaderno Molang', cat: 'papeleria', price: 4990, cost: 2600, weight: 200 },
  { sku: 'SYN-021', slug: 'syn-set-lapices', name: 'Set Lápices Pastel', cat: 'papeleria', price: 3490, cost: 1800, weight: 150 },
  { sku: 'SYN-022', slug: 'syn-stickers-kawaii', name: 'Stickers Kawaii', cat: 'papeleria', price: 1990, cost: 900, weight: 30 },
  { sku: 'SYN-023', slug: 'syn-washi-tape', name: 'Washi Tape x3', cat: 'papeleria', price: 2990, cost: 1500, weight: 90 },
  { sku: 'SYN-030', slug: 'syn-album-newjeans', name: 'Álbum NewJeans', cat: 'kpop', price: 19990, cost: 13000, weight: 350 },
  { sku: 'SYN-031', slug: 'syn-album-bts', name: 'Álbum BTS', cat: 'kpop', price: 21990, cost: 14500, weight: 350 },
  { sku: 'SYN-032', slug: 'syn-photocard-set', name: 'Set Photocards', cat: 'kpop', price: 5990, cost: 3000, weight: 40 },
  { sku: 'SYN-033', slug: 'syn-lightstick', name: 'Lightstick Oficial', cat: 'kpop', price: 39990, cost: 27000, weight: 500 },
  { sku: 'SYN-034', slug: 'syn-poster-set', name: 'Set de Pósters', cat: 'kpop', price: 4990, cost: 2400, weight: 120 },
];
// Combos que tienden a comprarse juntos (índices del catálogo) — para que el
// recomendador market-basket tenga señal real.
const COMBOS: number[][] = [
  [0, 1, 5], // peperos + banana milk
  [3, 4], // ramen + ramen
  [8, 9], // dos mascarillas
  [11, 12, 14], // rutina skincare
  [19, 21], // álbum + photocards
  [22, 23], // lightstick + photocards
  [15, 16], // cuaderno + lápices
];

// ── Geografía chilena (peso, envío base, factor de plazo) ─────────────────
interface Region { region: string; communes: string[]; ship: number; lag: number; w: number }
const REGIONS: Region[] = [
  { region: 'Región Metropolitana', communes: ['Santiago', 'Providencia', 'Ñuñoa', 'Maipú', 'La Florida', 'Puente Alto', 'Las Condes', 'Recoleta'], ship: 3000, lag: 0, w: 55 },
  { region: 'Valparaíso', communes: ['Valparaíso', 'Viña del Mar', 'Quilpué'], ship: 3500, lag: 1, w: 12 },
  { region: 'Biobío', communes: ['Concepción', 'Talcahuano'], ship: 4500, lag: 2, w: 9 },
  { region: 'Coquimbo', communes: ['La Serena', 'Coquimbo'], ship: 4500, lag: 2, w: 6 },
  { region: 'Araucanía', communes: ['Temuco', 'Padre Las Casas'], ship: 5000, lag: 3, w: 6 },
  { region: 'Los Lagos', communes: ['Puerto Montt', 'Osorno'], ship: 6000, lag: 4, w: 5 },
  { region: 'Antofagasta', communes: ['Antofagasta', 'Calama'], ship: 6500, lag: 4, w: 4 },
  { region: 'Maule', communes: ['Talca', 'Curicó'], ship: 4200, lag: 2, w: 3 },
];
const REGION_TOTAL_W = REGIONS.reduce((a, r) => a + r.w, 0);
function pickRegion(): Region {
  let t = rnd() * REGION_TOTAL_W;
  for (const r of REGIONS) { if ((t -= r.w) <= 0) return r; }
  return REGIONS[0]!;
}

// ── Estacionalidad: multiplicador de demanda por fecha ────────────────────
function seasonMultiplier(d: Date): number {
  const m = d.getMonth(); // 0=ene
  const day = d.getDate();
  let s = 1;
  // Fiestas patrias: rampa fuerte hacia el 18 de septiembre
  if (m === 8) s *= day <= 18 ? 1 + (day / 18) * 1.9 : 2.9 - ((day - 18) / 12) * 1.6;
  // Navidad: buildup diciembre, peak 15–24
  if (m === 11) s *= day <= 24 ? 1 + (day / 24) * 1.6 : 1.2;
  // CyberDay (aprox. inicio de octubre) y Cyber de invierno (fines de junio)
  if (m === 9 && day <= 3) s *= 2.2;
  if (m === 5 && day >= 26) s *= 1.9;
  // San Valentín / Día de la madre (leves)
  if (m === 1 && day >= 10 && day <= 14) s *= 1.4;
  if (m === 4 && day >= 5 && day <= 11) s *= 1.4;
  // Semana: jue–sáb un poco más altos
  const wd = d.getDay();
  s *= wd === 4 || wd === 5 || wd === 6 ? 1.15 : wd === 0 ? 0.85 : 1;
  return s;
}

interface Names { first: string[]; last: string[] }
const NAMES: Names = {
  first: ['Sofía', 'Martín', 'Valentina', 'Benjamín', 'Isidora', 'Vicente', 'Antonia', 'Matías', 'Florencia', 'Joaquín', 'Catalina', 'Diego', 'Javiera', 'Tomás', 'Emilia', 'Agustín'],
  last: ['González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva', 'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes', 'Araya'],
};

// ── Limpieza de lo sintético anterior (idempotencia; no toca datos reales) ─
async function wipeSynthetic() {
  const uf = { user: { email: { endsWith: USER_MARK } } };
  const of = { order: uf };
  const pf = { product: { sku: { startsWith: SKU_PREFIX } } };
  await db.orderStatusHistory.deleteMany({ where: of });
  await db.stockMovement.deleteMany({ where: { OR: [of, pf] } });
  await db.stockReservation.deleteMany({ where: { OR: [of, pf] } });
  await db.orderItem.deleteMany({ where: of });
  await db.stockAdjustment.deleteMany({ where: pf });
  await db.demandForecast.deleteMany({ where: pf });
  await db.restockSuggestion.deleteMany({ where: pf });
  await db.productRecommendation.deleteMany({ where: { OR: [pf, { recommended: { sku: { startsWith: SKU_PREFIX } } }] } });
  await db.order.deleteMany({ where: uf });
  await db.address.deleteMany({ where: uf });
  const synthUsers = await db.user.findMany({ where: { email: { endsWith: USER_MARK } }, select: { id: true } });
  if (synthUsers.length) {
    await db.customerSegment.deleteMany({ where: { userId: { in: synthUsers.map((u) => u.id) } } });
  }
  await db.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await db.user.deleteMany({ where: { email: { endsWith: USER_MARK } } });
}

async function insertChunked<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>, size = 500) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

async function main() {
  console.log('Limpiando datos sintéticos previos…');
  await wipeSynthetic();

  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - MONTHS);

  // ── Categorías (reutiliza/crea, igual que el seed real) ──
  const catDefs: { slug: Cat; name: string; order: number }[] = [
    { slug: 'snacks', name: 'Snacks', order: 1 },
    { slug: 'skincare', name: 'Skincare', order: 2 },
    { slug: 'papeleria', name: 'Papelería', order: 3 },
    { slug: 'kpop', name: 'K-pop', order: 4 },
  ];
  const catId: Record<Cat, string> = {} as Record<Cat, string>;
  for (const c of catDefs) {
    const row = await db.category.upsert({ where: { slug: c.slug }, update: {}, create: { name: c.name, slug: c.slug, description: `Categoría ${c.name}`, order: c.order } });
    catId[c.slug] = row.id;
  }

  // ── Productos sintéticos ──
  const prodId: string[] = CATALOG.map(() => id());
  const stockStart: number[] = CATALOG.map((p) => (p.price > 15000 ? 40 : p.price > 5000 ? 120 : 400));
  await insertChunked(
    CATALOG.map((p, i) => ({
      id: prodId[i]!, sku: p.sku, slug: p.slug, name: p.name, description: `${p.name} — producto de demostración (sintético).`,
      priceCLP: p.price, costCLP: p.cost, weightGrams: p.weight, stock: stockStart[i]!, images: [], active: true,
      categoryId: catId[p.cat], createdAt: start,
    })) satisfies Prisma.ProductCreateManyInput[],
    (c) => db.product.createMany({ data: c }),
  );

  // ── Clientes sintéticos ──
  const userId: string[] = [];
  const userRows: Prisma.UserCreateManyInput[] = [];
  for (let i = 0; i < N_CUSTOMERS; i++) {
    const uid = id();
    userId.push(uid);
    const created = new Date(start.getTime() + rnd() * (now.getTime() - start.getTime()) * 0.6);
    userRows.push({
      id: uid, email: `cliente${i + 1}${USER_MARK}`, passwordHash: 'SYNTHETIC_NO_LOGIN',
      firstName: pick(NAMES.first), lastName: pick(NAMES.last), role: 'CLIENT',
      consentEssential: true, consentMarketing: rnd() < 0.55, consentVersion: 'synthetic',
      consentAt: created, createdAt: created,
    });
  }
  await insertChunked(userRows, (c) => db.user.createMany({ data: c }));

  // ── Generación de pedidos con estacionalidad ──
  const orderRows: Prisma.OrderCreateManyInput[] = [];
  const itemRows: Prisma.OrderItemCreateManyInput[] = [];
  const historyRows: Prisma.OrderStatusHistoryCreateManyInput[] = [];
  const saleEvents: { productId: string; qty: number; date: Date; orderId: string }[] = [];

  const totalDays = Math.round((now.getTime() - start.getTime()) / 86400000);
  let orderCounter = 0;

  for (let dayIdx = 0; dayIdx < totalDays; dayIdx++) {
    const dayStart = new Date(start.getTime() + dayIdx * 86400000);
    const trend = 1 + (dayIdx / totalDays) * 0.6; // crecimiento del negocio en el tiempo
    const lambda = BASE_ORDERS_PER_DAY * seasonMultiplier(dayStart) * trend * (0.7 + rnd() * 0.6);
    const nOrders = Math.max(0, Math.round(lambda));

    for (let k = 0; k < nOrders; k++) {
      const oid = id();
      orderCounter++;
      const created = new Date(dayStart.getTime() + randInt(9, 22) * 3600000 + randInt(0, 59) * 60000);

      // Canasta: 35% usa un combo, resto aleatorio; 1–4 líneas
      const idxs = new Set<number>();
      if (rnd() < 0.35) pick(COMBOS).forEach((i) => idxs.add(i));
      const extra = randInt(0, 2);
      for (let e = 0; e < extra || idxs.size === 0; e++) idxs.add(randInt(0, CATALOG.length - 1));

      let subtotal = 0;
      const uid = pick(userId);
      const lineItems: Prisma.OrderItemCreateManyInput[] = [];
      for (const i of idxs) {
        const p = CATALOG[i]!;
        const qty = p.price > 15000 ? randInt(1, 2) : randInt(1, 4);
        subtotal += p.price * qty;
        lineItems.push({ id: id(), orderId: oid, productId: prodId[i]!, quantity: qty, unitPriceCLP: p.price, productName: p.name });
        saleEvents.push({ productId: prodId[i]!, qty, date: created, orderId: oid });
      }

      // Envío: 20% retiro en tienda, resto courier con región
      const isPickup = rnd() < 0.2;
      const reg = pickRegion();
      const method = isPickup ? 'PICKUP' : rnd() < 0.6 ? 'STARKEN' : 'CORREOS_CHILE';
      const shipping = isPickup ? 0 : reg.ship;
      const commune = isPickup ? null : pick(reg.communes);

      // Desenlace del pedido + línea de tiempo de estados
      const ageDays = (now.getTime() - created.getTime()) / 86400000;
      const roll = rnd();
      let status: OrderStatus = 'DELIVERED';
      let paymentStatus: 'PAID' | 'UNPAID' | 'FAILED' = 'PAID';
      let paidAt: Date | null = null;
      let shippedAt: Date | null = null;
      let deliveredAt: Date | null = null;

      const transitions: { from: OrderStatus | null; to: OrderStatus; at: Date }[] = [{ from: null, to: 'PENDING', at: created }];

      if (roll < 0.04) {
        // Abandonado sin pago
        status = 'PENDING'; paymentStatus = 'UNPAID';
      } else {
        paidAt = new Date(created.getTime() + randInt(1, 240) * 60000);
        transitions.push({ from: 'PENDING', to: 'PAID', at: paidAt });
        if (roll < 0.10) {
          // Cancelado tras pagar (se reembolsa)
          status = 'CANCELLED'; paymentStatus = 'PAID';
          transitions.push({ from: 'PAID', to: 'CANCELLED', at: new Date(paidAt.getTime() + randInt(1, 48) * 3600000) });
        } else {
          const prepAt = new Date(paidAt.getTime() + randInt(2, 30) * 3600000);
          transitions.push({ from: 'PAID', to: 'PREPARING', at: prepAt });
          shippedAt = new Date(prepAt.getTime() + randInt(4, 30) * 3600000);
          const courierLag = (method === 'CORREOS_CHILE' ? 3 : method === 'STARKEN' ? 2 : 0) + reg.lag;
          const delAt = new Date(shippedAt.getTime() + (courierLag + randInt(0, 2)) * 86400000);

          if (ageDays < 2) {
            status = 'PREPARING'; shippedAt = null;
          } else if (delAt > now) {
            status = 'SHIPPED';
            transitions.push({ from: 'PREPARING', to: 'SHIPPED', at: shippedAt });
          } else {
            status = 'DELIVERED'; deliveredAt = delAt;
            transitions.push({ from: 'PREPARING', to: 'SHIPPED', at: shippedAt });
            transitions.push({ from: 'SHIPPED', to: 'DELIVERED', at: deliveredAt });
          }
        }
      }

      const fullName = `${pick(NAMES.first)} ${pick(NAMES.last)}`;
      orderRows.push({
        id: oid, userId: uid, subtotalCLP: subtotal, shippingCLP: shipping, totalCLP: subtotal + shipping,
        status, paymentStatus, paymentProvider: paymentStatus === 'PAID' ? (rnd() < 0.6 ? 'transbank' : 'mercadopago') : null,
        paidAt, shippedAt, deliveredAt, shippingMethod: method,
        shippingFullName: fullName, shippingPhone: `+5695${randInt(1000000, 9999999)}`,
        shippingStreet: isPickup ? null : `Calle ${pick(NAMES.last)}`, shippingNumber: isPickup ? null : String(randInt(100, 9999)),
        shippingCommune: commune, shippingRegion: isPickup ? null : reg.region,
        shippingNotes: '[SYNTHETIC]', createdAt: created,
      });
      itemRows.push(...lineItems);
      for (const t of transitions) historyRows.push({ id: id(), orderId: oid, fromStatus: t.from, toStatus: t.to, actorId: 'seed', note: '[SYNTHETIC]', createdAt: t.at });
    }
  }

  // ── Inventario: INITIAL_LOAD + SALE (cronológico) + RESTOCK + mermas ──
  const movementRows: Prisma.StockMovementCreateManyInput[] = [];
  const stock: number[] = [...stockStart];
  CATALOG.forEach((_, i) => {
    movementRows.push({ id: id(), productId: prodId[i]!, type: 'IN', reason: 'INITIAL_LOAD', quantity: stockStart[i]!, previousStock: 0, resultingStock: stockStart[i]!, createdAt: start });
  });
  const idxOf = new Map(prodId.map((pid, i) => [pid, i]));
  saleEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const ev of saleEvents) {
    const i = idxOf.get(ev.productId)!;
    if (stock[i]! < ev.qty + 3) {
      const target = stockStart[i]!;
      const add = target - stock[i]!;
      if (add > 0) {
        movementRows.push({ id: id(), productId: ev.productId, type: 'IN', reason: 'RESTOCK', quantity: add, previousStock: stock[i]!, resultingStock: target, createdAt: new Date(ev.date.getTime() - 3600000) });
        stock[i] = target;
      }
    }
    const prev = stock[i]!;
    stock[i] = prev - ev.qty;
    movementRows.push({ id: id(), productId: ev.productId, type: 'OUT', reason: 'SALE', quantity: ev.qty, previousStock: prev, resultingStock: stock[i]!, orderId: ev.orderId, createdAt: ev.date });
  }
  // Mermas ocasionales (para analítica de DAMAGED/EXPIRED)
  for (let i = 0; i < CATALOG.length; i++) {
    const nMerma = randInt(0, 3);
    for (let m = 0; m < nMerma; m++) {
      const q = randInt(1, 3);
      if (stock[i]! < q) continue;
      const prev = stock[i]!;
      stock[i] = prev - q;
      const when = new Date(start.getTime() + rnd() * (now.getTime() - start.getTime()));
      movementRows.push({ id: id(), productId: prodId[i]!, type: 'OUT', reason: rnd() < 0.5 ? 'DAMAGED' : 'EXPIRED', quantity: q, previousStock: prev, resultingStock: stock[i]!, createdAt: when });
    }
  }

  console.log(`Insertando ${orderRows.length} pedidos, ${itemRows.length} ítems, ${movementRows.length} movimientos, ${historyRows.length} transiciones…`);
  await insertChunked(orderRows, (c) => db.order.createMany({ data: c }));
  await insertChunked(itemRows, (c) => db.orderItem.createMany({ data: c }));
  await insertChunked(historyRows, (c) => db.orderStatusHistory.createMany({ data: c }));
  await insertChunked(movementRows, (c) => db.stockMovement.createMany({ data: c }));

  // Deja el stock final coherente con la simulación
  for (let i = 0; i < CATALOG.length; i++) {
    await db.product.update({ where: { id: prodId[i]! }, data: { stock: Math.max(0, stock[i]!) } });
  }

  console.log('\nDataset sintético listo:');
  console.log(`  clientes:   ${userId.length}`);
  console.log(`  productos:  ${CATALOG.length}`);
  console.log(`  pedidos:    ${orderRows.length}  (~${MONTHS} meses con estacionalidad)`);
  console.log('  Marcado como sintético — re-ejecuta el script para regenerar sin duplicar.\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
