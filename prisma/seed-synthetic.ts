/**
 * Dataset SINTÉTICO para el subsistema de análisis de datos y ML (Fase 0).
 *
 * Genera ~24 meses de historia comercial coherente, hasta HOY, con:
 *   - estacionalidad chilena (Fiestas Patrias, Navidad, CyberDay) y crecimiento;
 *   - clientes realistas: la mayoría compra 1–2 veces y unos pocos son fieles
 *     (cola larga); nadie compra antes de registrarse, y los clientes se
 *     "enfrían" si pasa tiempo sin comprar;
 *   - popularidad desigual de productos (unos pocos venden mucho: Pareto);
 *   - horarios en hora de Chile, con picos a mediodía y en la noche;
 *   - envío con la regla REAL de la tienda (src/lib/shipping.ts: tarifa plana,
 *     gratis sobre el umbral, retiro sin costo);
 *   - cancelaciones después de pagar marcadas como REEMBOLSADAS, y pagos que
 *     nunca se completaron marcados como fallidos;
 *   - afinidad de canasta ("se compran juntos"), geografía chilena, movimientos
 *     de inventario y bitácora de estados.
 *
 * Se escribe con el cliente Prisma (misma conexión del .env). Todo va marcado:
 *   - usuarios con email  @seed.hachiko.test
 *   - productos con SKU   SYN-###
 * Re-ejecutar BORRA lo sintético anterior y regenera hasta la fecha de hoy, sin
 * tocar datos reales. Ejecutar con:  pnpm db:seed:synthetic
 * Después: pnpm db:seed:security, pnpm db:seed:analytics y reentrenar /ml.
 */
import { PrismaClient, type Prisma, type OrderStatus, type PaymentStatus, type ShippingMethod } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { encrypt } from '../src/lib/crypto/pii';
import { calculateShipping } from '../src/lib/shipping';
import { storeLocalToUtc } from '../src/lib/store-time';

// Carga masiva: usa la conexión DIRECTA (no pooled) para evitar límites del
// pooler serverless de Neon en inserciones grandes.
const db = new PrismaClient({
  datasourceUrl: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
});

// ── Marcadores y parámetros ──────────────────────────────────────────────
const USER_MARK = '@seed.hachiko.test';
const SKU_PREFIX = 'SYN-';
const MONTHS = 24;
const BASE_ORDERS_PER_DAY = 4; // media al inicio; se multiplica por estacionalidad/tendencia
const NEW_CUSTOMER_SHARE = 0.45; // de cada pedido, probabilidad de que sea de alguien nuevo
const GUEST_SHARE = 0.12; // de los clientes nuevos, cuántos compran como invitado
const BROWSERS_SHARE = 0.18; // cuentas creadas que nunca compran (sobre el total de compradores)
const RNG_SEED = 20261008;

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
function pickWeighted(weights: readonly number[], total?: number): number {
  let t = rnd() * (total ?? weights.reduce((a, w) => a + w, 0));
  for (let i = 0; i < weights.length; i++) if ((t -= weights[i]!) <= 0) return i;
  return weights.length - 1;
}

// ── Catálogo sintético (con costCLP para analítica de márgenes) ───────────
type Cat = 'snacks' | 'skincare' | 'papeleria' | 'kpop' | 'bebestibles' | 'sopas';
interface P { sku: string; kr: string; slug: string; name: string; cat: Cat; price: number; cost: number; weight: number }
const CATALOG: P[] = [
  { sku: 'SYN-001', kr: '빼빼로 초코', slug: 'syn-pepero-choco', name: 'Pepero Chocolate', cat: 'snacks', price: 1990, cost: 1200, weight: 60 },
  { sku: 'SYN-002', kr: '아몬드 빼빼로', slug: 'syn-pepero-almendra', name: 'Pepero Almendra', cat: 'snacks', price: 2190, cost: 1300, weight: 60 },
  { sku: 'SYN-003', kr: '초코파이', slug: 'syn-choco-pie', name: 'Choco Pie (caja)', cat: 'snacks', price: 3990, cost: 2500, weight: 300 },
  { sku: 'SYN-004', kr: '신라면', slug: 'syn-ramen-shin', name: 'Ramen Shin Picante', cat: 'snacks', price: 1490, cost: 850, weight: 120 },
  { sku: 'SYN-005', kr: '불닭볶음면', slug: 'syn-ramen-buldak', name: 'Ramen Buldak 2x', cat: 'snacks', price: 2990, cost: 1800, weight: 280 },
  { sku: 'SYN-006', kr: '바나나맛 우유', slug: 'syn-banana-milk', name: 'Banana Milk', cat: 'snacks', price: 1690, cost: 1000, weight: 240 },
  { sku: 'SYN-007', kr: '허니버터칩', slug: 'syn-honey-butter-chips', name: 'Honey Butter Chips', cat: 'snacks', price: 2490, cost: 1500, weight: 60 },
  { sku: 'SYN-008', kr: '테이프 젤리', slug: 'syn-gummy-tape', name: 'Gomitas Cinta', cat: 'snacks', price: 1290, cost: 700, weight: 40 },
  { sku: 'SYN-010', kr: '알로에 마스크팩', slug: 'syn-sheet-mask-aloe', name: 'Mascarilla Aloe', cat: 'skincare', price: 1990, cost: 900, weight: 30 },
  { sku: 'SYN-011', kr: '달팽이 마스크팩', slug: 'syn-sheet-mask-snail', name: 'Mascarilla Caracol', cat: 'skincare', price: 2490, cost: 1100, weight: 30 },
  { sku: 'SYN-012', kr: '녹차 토너', slug: 'syn-toner-verde', name: 'Tónico Té Verde', cat: 'skincare', price: 8990, cost: 5200, weight: 200 },
  { sku: 'SYN-013', kr: '비타민C 세럼', slug: 'syn-serum-vitc', name: 'Serum Vitamina C', cat: 'skincare', price: 12990, cost: 7500, weight: 80 },
  { sku: 'SYN-014', kr: '달팽이 크림', slug: 'syn-crema-snail', name: 'Crema Caracol', cat: 'skincare', price: 14990, cost: 8800, weight: 120 },
  { sku: 'SYN-015', kr: '선크림', slug: 'syn-protector-solar', name: 'Protector Solar SPF50', cat: 'skincare', price: 9990, cost: 5800, weight: 100 },
  { sku: 'SYN-016', kr: '립 틴트', slug: 'syn-lip-tint', name: 'Lip Tint Coreano', cat: 'skincare', price: 6990, cost: 3900, weight: 20 },
  { sku: 'SYN-020', kr: '몰랑 노트', slug: 'syn-cuaderno-molang', name: 'Cuaderno Molang', cat: 'papeleria', price: 4990, cost: 2600, weight: 200 },
  { sku: 'SYN-021', kr: '파스텔 연필', slug: 'syn-set-lapices', name: 'Set Lápices Pastel', cat: 'papeleria', price: 3490, cost: 1800, weight: 150 },
  { sku: 'SYN-022', kr: '스티커', slug: 'syn-stickers-kawaii', name: 'Stickers Kawaii', cat: 'papeleria', price: 1990, cost: 900, weight: 30 },
  { sku: 'SYN-023', kr: '마스킹 테이프', slug: 'syn-washi-tape', name: 'Washi Tape x3', cat: 'papeleria', price: 2990, cost: 1500, weight: 90 },
  { sku: 'SYN-030', kr: '뉴진스 앨범', slug: 'syn-album-newjeans', name: 'Álbum NewJeans', cat: 'kpop', price: 19990, cost: 13000, weight: 350 },
  { sku: 'SYN-031', kr: '방탄소년단 앨범', slug: 'syn-album-bts', name: 'Álbum BTS', cat: 'kpop', price: 21990, cost: 14500, weight: 350 },
  { sku: 'SYN-032', kr: '포토카드', slug: 'syn-photocard-set', name: 'Set Photocards', cat: 'kpop', price: 5990, cost: 3000, weight: 40 },
  { sku: 'SYN-033', kr: '응원봉', slug: 'syn-lightstick', name: 'Lightstick Oficial', cat: 'kpop', price: 39990, cost: 27000, weight: 500 },
  { sku: 'SYN-034', kr: '포스터', slug: 'syn-poster-set', name: 'Set de Pósters', cat: 'kpop', price: 4990, cost: 2400, weight: 120 },
  // Bebestibles (índices 24-27)
  { sku: 'SYN-040', kr: '밀키스', slug: 'syn-milkis', name: 'Milkis Soda', cat: 'bebestibles', price: 1490, cost: 800, weight: 250 },
  { sku: 'SYN-041', kr: '알로에 음료', slug: 'syn-aloe-drink', name: 'Bebida Aloe Vera', cat: 'bebestibles', price: 1690, cost: 950, weight: 500 },
  { sku: 'SYN-042', kr: '식혜', slug: 'syn-sikhye', name: 'Sikhye (bebida de arroz)', cat: 'bebestibles', price: 1990, cost: 1150, weight: 240 },
  { sku: 'SYN-043', kr: '요구르트', slug: 'syn-yogurt-bebible', name: 'Yogurt Bebible Coreano', cat: 'bebestibles', price: 1290, cost: 700, weight: 150 },
  // Sopas (índices 28-31)
  { sku: 'SYN-050', kr: '진라면', slug: 'syn-ramyun-jin', name: 'Ramyun Jin', cat: 'sopas', price: 1590, cost: 900, weight: 120 },
  { sku: 'SYN-051', kr: '삼양라면', slug: 'syn-ramyun-samyang', name: 'Ramyun Samyang', cat: 'sopas', price: 1690, cost: 950, weight: 130 },
  { sku: 'SYN-052', kr: '우동', slug: 'syn-udon-instant', name: 'Udon Instantáneo', cat: 'sopas', price: 2490, cost: 1500, weight: 250 },
  { sku: 'SYN-053', kr: '김치찌개', slug: 'syn-kimchi-soup', name: 'Sopa de Kimchi', cat: 'sopas', price: 2990, cost: 1800, weight: 300 },
];

// Popularidad desigual: en una tienda real unos pocos productos explican la
// mayor parte de las ventas. Peso ∝ 1/rango^1.6 sobre un orden fijo (sembrado).
const POPULARITY: number[] = (() => {
  const order = CATALOG.map((_, i) => i).sort(() => rnd() - 0.5);
  const w = new Array<number>(CATALOG.length);
  order.forEach((idx, rank) => (w[idx] = 1 / Math.pow(rank + 1, 1.6)));
  return w;
})();
const POPULARITY_TOTAL = POPULARITY.reduce((a, w) => a + w, 0);

// Combos que tienden a comprarse juntos (índices del catálogo) — para que el
// recomendador market-basket tenga señal real.
const COMBOS: number[][] = [
  [0, 1, 5], // peperos + banana milk
  [3, 4], // ramen + ramen
  [8, 9], // dos mascarillas
  [11, 12, 14], // rutina skincare
  [19, 21], // álbum + photocards
  [22, 21], // lightstick + photocards
  [15, 16], // cuaderno + lápices
  [28, 24], // ramyun jin + milkis (sopa + bebida)
  [29, 25], // samyang + aloe
  [30, 31], // udon + sopa kimchi
  [4, 28], // ramen buldak + ramyun jin (picantes juntos)
  [26, 30], // sikhye + udon
];

// ── Geografía chilena (peso, días extra de courier) ───────────────────────
interface Region { region: string; communes: string[]; lag: number; w: number }
const REGIONS: Region[] = [
  { region: 'Región Metropolitana', communes: ['Santiago', 'Providencia', 'Ñuñoa', 'Maipú', 'La Florida', 'Puente Alto', 'Las Condes', 'Recoleta'], lag: 0, w: 58 },
  { region: 'Valparaíso', communes: ['Valparaíso', 'Viña del Mar', 'Quilpué'], lag: 1, w: 12 },
  { region: 'Biobío', communes: ['Concepción', 'Talcahuano'], lag: 2, w: 8 },
  { region: 'Coquimbo', communes: ['La Serena', 'Coquimbo'], lag: 2, w: 6 },
  { region: 'Araucanía', communes: ['Temuco', 'Padre Las Casas'], lag: 3, w: 5 },
  { region: 'Los Lagos', communes: ['Puerto Montt', 'Osorno'], lag: 4, w: 4 },
  { region: 'Antofagasta', communes: ['Antofagasta', 'Calama'], lag: 4, w: 4 },
  { region: 'Maule', communes: ['Talca', 'Curicó'], lag: 2, w: 3 },
];
// Dentro de una región no todas las comunas pesan igual (las primeras, más).
const COMMUNE_W = (n: number) => Array.from({ length: n }, (_, i) => 1 / (i + 1) ** 0.6);

// ── Hora del pedido (hora de Chile): mediodía y noche, poco de madrugada ──
const HOUR_W = [0.6, 0.3, 0.15, 0.08, 0.08, 0.12, 0.3, 0.6, 1, 1.4, 1.8, 2.2, 2.6, 2.6, 2.3, 2, 2, 2.2, 2.6, 3, 3.3, 3.2, 2.6, 1.4];

// ── Estacionalidad: multiplicador de demanda por fecha (calendario de Chile) ──
function seasonMultiplier(m: number, day: number, weekday: number): number {
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
  s *= weekday === 4 || weekday === 5 || weekday === 6 ? 1.15 : weekday === 0 ? 0.85 : 1;
  return s;
}

interface Names { first: string[]; last: string[] }
const NAMES: Names = {
  first: ['Sofía', 'Martín', 'Valentina', 'Benjamín', 'Isidora', 'Vicente', 'Antonia', 'Matías', 'Florencia', 'Joaquín', 'Catalina', 'Diego', 'Javiera', 'Tomás', 'Emilia', 'Agustín', 'Fernanda', 'Camila', 'Ignacio', 'Constanza'],
  last: ['González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva', 'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes', 'Araya', 'Espinoza', 'Valenzuela', 'Tapia'],
};

// ── Limpieza de lo sintético anterior (idempotencia; no toca datos reales) ─
async function wipeSynthetic() {
  const uf = { user: { email: { endsWith: USER_MARK } } };
  const of = { order: uf };
  const pf = { product: { sku: { startsWith: SKU_PREFIX } } };
  await db.orderStatusHistory.deleteMany({ where: of });
  // Movimientos sintéticos: los de pedidos sintéticos y las cargas/reposiciones
  // simuladas (sin pedido). Las ventas REALES de un producto SYN se conservan.
  await db.stockMovement.deleteMany({ where: { OR: [of, { ...pf, orderId: null }] } });
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
    const ids = synthUsers.map((u) => u.id);
    await db.customerSegment.deleteMany({ where: { userId: { in: ids } } });
    await db.riskScore.deleteMany({ where: { subjectId: { in: ids } } });
  }
  // Los productos SYN NO se borran: si alguien hizo una compra real de prueba con
  // uno de ellos, borrarlo rompería ese pedido (la base lo impide y el seed se
  // caía a la mitad). Se reutilizan y se actualizan más abajo.
  await db.user.deleteMany({ where: { email: { endsWith: USER_MARK } } });
}

async function insertChunked<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>, size = 500) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

// ── Clientes ───────────────────────────────────────────────────────────────
interface Customer { id: string; createdAt: Date; loyalty: number; lastOrderAt: number | null }

async function main() {
  console.log('Limpiando datos sintéticos previos…');
  await wipeSynthetic();

  const now = new Date();
  // Día 0 = hoy hace MONTHS meses, en el calendario de Chile.
  const todayCl = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(now).split('-').map(Number);
  const startCal = new Date(Date.UTC(todayCl[0]!, todayCl[1]! - 1 - MONTHS, todayCl[2]!));
  const start = storeLocalToUtc(startCal.getUTCFullYear(), startCal.getUTCMonth(), startCal.getUTCDate());

  // ── Categorías (reutiliza/crea, igual que el seed real) ──
  const catDefs: { slug: Cat; name: string; order: number }[] = [
    { slug: 'snacks', name: 'Snacks', order: 1 },
    { slug: 'skincare', name: 'Skincare', order: 2 },
    { slug: 'papeleria', name: 'Papelería', order: 3 },
    { slug: 'kpop', name: 'K-pop', order: 4 },
    { slug: 'bebestibles', name: 'Bebestibles', order: 5 },
    { slug: 'sopas', name: 'Sopas', order: 6 },
  ];
  const catId: Record<Cat, string> = {} as Record<Cat, string>;
  for (const c of catDefs) {
    const row = await db.category.upsert({ where: { slug: c.slug }, update: {}, create: { name: c.name, slug: c.slug, description: `Categoría ${c.name}`, order: c.order } });
    catId[c.slug] = row.id;
  }

  // ── Productos sintéticos: se reutilizan por SKU (mismo id) o se crean ──
  const stockStart: number[] = CATALOG.map((p, i) => {
    const base = p.price > 15000 ? 30 : p.price > 5000 ? 80 : 200;
    return Math.round(base * (0.6 + (POPULARITY[i]! / POPULARITY_TOTAL) * 12));
  });
  const existing = new Map(
    (await db.product.findMany({ where: { sku: { in: CATALOG.map((p) => p.sku) } }, select: { id: true, sku: true } }))
      .map((p) => [p.sku, p.id]),
  );
  const prodId: string[] = CATALOG.map((p) => existing.get(p.sku) ?? id());
  for (let i = 0; i < CATALOG.length; i++) {
    const p = CATALOG[i]!;
    const data = {
      sku: p.sku, slug: p.slug, name: p.name, nameKorean: p.kr, description: `${p.name} — producto de demostración (sintético).`,
      priceCLP: p.price, costCLP: p.cost, weightGrams: p.weight, stock: stockStart[i]!, active: true, archivedAt: null,
      categoryId: catId[p.cat], createdAt: start,
    };
    if (existing.has(p.sku)) await db.product.update({ where: { id: prodId[i]! }, data });
    else await db.product.create({ data: { id: prodId[i]!, images: [], ...data } });
  }

  // ── Pedidos, día por día (calendario de Chile) ──
  const customers: Customer[] = [];
  const userRows: Prisma.UserCreateManyInput[] = [];
  const orderRows: Prisma.OrderCreateManyInput[] = [];
  const itemRows: Prisma.OrderItemCreateManyInput[] = [];
  const historyRows: Prisma.OrderStatusHistoryCreateManyInput[] = [];
  const saleEvents: { productId: string; qty: number; date: Date; orderId: string }[] = [];

  const newCustomer = (orderAt: Date, guest: boolean): Customer => {
    // La mayoría crea la cuenta al comprar; algunos la tenían de antes.
    const earlier = !guest && rnd() < 0.3 ? randInt(1, 60) * 86_400_000 : randInt(2, 40) * 60_000;
    const createdAt = new Date(Math.max(start.getTime(), orderAt.getTime() - earlier));
    const c: Customer = {
      id: id(), createdAt,
      // Fidelidad con cola larga: la mayoría ~0, unos pocos muy fieles. Invitados no vuelven.
      loyalty: guest ? 0 : Math.pow(rnd(), 3) * 6,
      lastOrderAt: null,
    };
    userRows.push({
      id: c.id, email: `cliente${userRows.length + 1}${USER_MARK}`, passwordHash: 'SYNTHETIC_NO_LOGIN',
      firstName: pick(NAMES.first), lastName: pick(NAMES.last), role: 'CLIENT', isGuest: guest,
      consentEssential: true, consentMarketing: !guest && rnd() < 0.45, consentVersion: 'synthetic',
      consentAt: createdAt, createdAt,
    });
    if (!guest) customers.push(c);
    return c;
  };

  // Elige un cliente que vuelve: según su fidelidad y cuánto hace que no compra
  // (se enfría con el tiempo: a los ~4 meses sin comprar, casi no vuelve).
  const returning = (at: number): Customer | null => {
    let total = 0;
    const w = customers.map((c) => {
      if (c.createdAt.getTime() > at || c.lastOrderAt === null) return 0;
      const days = (at - c.lastOrderAt) / 86_400_000;
      const v = days < 3 ? 0 : c.loyalty * Math.exp(-days / 120);
      total += v;
      return v;
    });
    return total > 0 ? customers[pickWeighted(w, total)]! : null;
  };

  const totalDays = Math.round((now.getTime() - start.getTime()) / 86_400_000);
  for (let dayIdx = 0; dayIdx <= totalDays; dayIdx++) {
    const cal = new Date(startCal.getTime() + dayIdx * 86_400_000);
    const [y, m, d, wd] = [cal.getUTCFullYear(), cal.getUTCMonth(), cal.getUTCDate(), cal.getUTCDay()];
    const trend = 1 + (dayIdx / totalDays) * 0.6; // crecimiento del negocio en el tiempo
    const lambda = BASE_ORDERS_PER_DAY * seasonMultiplier(m, d, wd) * trend * (0.7 + rnd() * 0.6);
    const nOrders = Math.max(0, Math.round(lambda));

    for (let k = 0; k < nOrders; k++) {
      const created = storeLocalToUtc(y, m, d, pickWeighted(HOUR_W), randInt(0, 59));
      if (created > now) continue;

      const back = rnd() >= NEW_CUSTOMER_SHARE ? returning(created.getTime()) : null;
      const customer = back ?? newCustomer(created, rnd() < GUEST_SHARE);
      customer.lastOrderAt = created.getTime();

      // Canasta: 35% usa un combo; el resto, productos según popularidad; 1–3 líneas
      const oid = id();
      const idxs = new Set<number>();
      if (rnd() < 0.35) pick(COMBOS).forEach((i) => idxs.add(i));
      const extra = randInt(0, 2);
      for (let e = 0; e < extra || idxs.size === 0; e++) idxs.add(pickWeighted(POPULARITY, POPULARITY_TOTAL));

      let subtotal = 0;
      for (const i of idxs) {
        const p = CATALOG[i]!;
        const qty = p.price > 15000 ? 1 : p.price > 5000 ? randInt(1, 2) : randInt(1, 4);
        subtotal += p.price * qty;
        itemRows.push({ id: id(), orderId: oid, productId: prodId[i]!, quantity: qty, unitPriceCLP: p.price, productName: p.name });
        saleEvents.push({ productId: prodId[i]!, qty, date: created, orderId: oid });
      }

      // Envío con la regla real de la tienda: 20% retira en Recoleta.
      const isPickup = rnd() < 0.2;
      const method: ShippingMethod = isPickup ? 'PICKUP' : rnd() < 0.6 ? 'STARKEN' : 'CORREOS_CHILE';
      const shipping = calculateShipping(subtotal, method);
      const reg = isPickup ? null : REGIONS[pickWeighted(REGIONS.map((r) => r.w))]!;
      const commune = reg ? reg.communes[pickWeighted(COMMUNE_W(reg.communes.length))]! : null;

      // Desenlace del pedido + línea de tiempo de estados
      const ageH = (now.getTime() - created.getTime()) / 3_600_000;
      const roll = rnd();
      let status: OrderStatus = 'DELIVERED';
      let paymentStatus: PaymentStatus = 'PAID';
      let paidAt: Date | null = null;
      let shippedAt: Date | null = null;
      let deliveredAt: Date | null = null;
      const transitions: { from: OrderStatus | null; to: OrderStatus; at: Date }[] = [{ from: null, to: 'PENDING', at: created }];
      const push = (from: OrderStatus, to: OrderStatus, at: Date) => {
        if (at <= now) transitions.push({ from, to, at });
      };

      if (roll < 0.04) {
        // Nunca pagó: si ya pasó un día, el pago se da por fallido y se cancela.
        if (ageH < 24) {
          status = 'PENDING'; paymentStatus = 'UNPAID';
        } else {
          status = 'CANCELLED'; paymentStatus = 'FAILED';
          push('PENDING', 'CANCELLED', new Date(created.getTime() + 24 * 3_600_000));
        }
      } else {
        paidAt = new Date(created.getTime() + randInt(1, 30) * 60_000);
        push('PENDING', 'PAID', paidAt);
        const prepAt = new Date(paidAt.getTime() + randInt(2, 20) * 3_600_000);
        const readyAt = new Date(prepAt.getTime() + randInt(3, 24) * 3_600_000);
        const lag = isPickup ? randInt(0, 3) : (method === 'CORREOS_CHILE' ? 3 : 2) + reg!.lag + randInt(0, 2);
        const doneAt = new Date(readyAt.getTime() + lag * 86_400_000 + randInt(1, 8) * 3_600_000);

        if (roll < 0.065) {
          // Cancelado después de pagar → se reembolsa
          status = 'CANCELLED'; paymentStatus = 'REFUNDED';
          push('PAID', 'CANCELLED', new Date(paidAt.getTime() + randInt(1, 48) * 3_600_000));
        } else if (prepAt > now) {
          status = 'PAID';
        } else if (readyAt > now) {
          status = 'PREPARING'; push('PAID', 'PREPARING', prepAt);
        } else if (doneAt > now) {
          status = 'SHIPPED'; shippedAt = readyAt;
          push('PAID', 'PREPARING', prepAt); push('PREPARING', 'SHIPPED', readyAt);
        } else {
          status = 'DELIVERED'; shippedAt = readyAt; deliveredAt = doneAt;
          push('PAID', 'PREPARING', prepAt); push('PREPARING', 'SHIPPED', readyAt); push('SHIPPED', 'DELIVERED', doneAt);
        }
      }

      const fullName = `${pick(NAMES.first)} ${pick(NAMES.last)}`;
      orderRows.push({
        id: oid, userId: customer.id, subtotalCLP: subtotal, shippingCLP: shipping, totalCLP: subtotal + shipping,
        status, paymentStatus,
        paymentProvider: paidAt ? (rnd() < 0.6 ? 'transbank' : 'mercadopago') : null,
        paidAt, shippedAt, deliveredAt, shippingMethod: method,
        // PII cifrada con AES-256-GCM, igual que el checkout real (createOrder),
        // para que la vista del vendedor pueda descifrarla sin romperse.
        shippingFullName: encrypt(fullName), shippingPhone: encrypt(`+5695${randInt(1000000, 9999999)}`),
        shippingStreet: isPickup ? null : encrypt(`Calle ${pick(NAMES.last)}`), shippingNumber: isPickup ? null : encrypt(String(randInt(100, 9999))),
        shippingCommune: commune, shippingRegion: reg?.region ?? null,
        shippingNotes: '[SYNTHETIC]', createdAt: created,
      });
      for (const t of transitions) historyRows.push({ id: id(), orderId: oid, fromStatus: t.from, toStatus: t.to, actorId: 'seed', note: '[SYNTHETIC]', createdAt: t.at });
    }
  }

  // Pedidos sospechosos inyectados (como los ataques del seed de seguridad), para
  // que el detector de fraude tenga casos que mostrar: invitado o cuenta recién
  // creada, de madrugada, muchas unidades de lo más caro, pagado y sin despachar.
  const SUSPICIOUS = [
    { items: [[22, 4], [20, 3]], hour: 3, ago: 1 },
    { items: [[22, 3], [19, 3], [12, 4]], hour: 4, ago: 2 },
    { items: [[13, 6], [11, 5]], hour: 2, ago: 0 },
  ] as const;
  for (const s of SUSPICIOUS) {
    const when = new Date(now.getTime() - s.ago * 86_400_000);
    const cal = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(when).split('-').map(Number);
    let created = storeLocalToUtc(cal[0]!, cal[1]! - 1, cal[2]!, s.hour, randInt(0, 59));
    if (created > now) created = new Date(now.getTime() - 3_600_000);
    const customer = newCustomer(created, true);
    const oid = id();
    let subtotal = 0;
    for (const [i, qty] of s.items) {
      const p = CATALOG[i]!;
      subtotal += p.price * qty;
      itemRows.push({ id: id(), orderId: oid, productId: prodId[i]!, quantity: qty, unitPriceCLP: p.price, productName: p.name });
      saleEvents.push({ productId: prodId[i]!, qty, date: created, orderId: oid });
    }
    const paidAt = new Date(created.getTime() + 3 * 60_000);
    orderRows.push({
      id: oid, userId: customer.id, subtotalCLP: subtotal, shippingCLP: 0, totalCLP: subtotal,
      status: 'PAID', paymentStatus: 'PAID', paymentProvider: 'mercadopago', paidAt, shippingMethod: 'PICKUP',
      shippingFullName: encrypt(`${pick(NAMES.first)} ${pick(NAMES.last)}`), shippingPhone: encrypt(`+5695${randInt(1000000, 9999999)}`),
      shippingNotes: '[SYNTHETIC]', createdAt: created,
    });
    historyRows.push({ id: id(), orderId: oid, fromStatus: null, toStatus: 'PENDING', actorId: 'seed', note: '[SYNTHETIC]', createdAt: created });
    historyRows.push({ id: id(), orderId: oid, fromStatus: 'PENDING', toStatus: 'PAID', actorId: 'seed', note: '[SYNTHETIC]', createdAt: paidAt });
  }

  // Cuentas que se registraron y nunca compraron (mirones).
  const buyers = userRows.length;
  for (let i = 0; i < Math.round(buyers * BROWSERS_SHARE); i++) {
    const createdAt = new Date(start.getTime() + rnd() * (now.getTime() - start.getTime()));
    userRows.push({
      id: id(), email: `cliente${userRows.length + 1}${USER_MARK}`, passwordHash: 'SYNTHETIC_NO_LOGIN',
      firstName: pick(NAMES.first), lastName: pick(NAMES.last), role: 'CLIENT',
      consentEssential: true, consentMarketing: rnd() < 0.4, consentVersion: 'synthetic',
      consentAt: createdAt, createdAt,
    });
  }

  // ── Inventario: INITIAL_LOAD + SALE (cronológico) + RESTOCK + mermas ──
  // Solo descuentan stock los pedidos que se pagaron y no se cancelaron.
  const soldOrders = new Set(orderRows.filter((o) => o.paymentStatus === 'PAID').map((o) => o.id));
  const movementRows: Prisma.StockMovementCreateManyInput[] = [];
  const stock: number[] = [...stockStart];
  CATALOG.forEach((_, i) => {
    movementRows.push({ id: id(), productId: prodId[i]!, type: 'IN', reason: 'INITIAL_LOAD', quantity: stockStart[i]!, previousStock: 0, resultingStock: stockStart[i]!, createdAt: start });
  });
  const idxOf = new Map(prodId.map((pid, i) => [pid, i]));
  saleEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const ev of saleEvents) {
    if (!soldOrders.has(ev.orderId)) continue;
    const i = idxOf.get(ev.productId)!;
    // Reposición cuando queda poco (punto de pedido ~15% del stock objetivo).
    if (stock[i]! < Math.max(ev.qty + 2, stockStart[i]! * 0.15)) {
      const add = stockStart[i]! - stock[i]!;
      if (add > 0) {
        movementRows.push({ id: id(), productId: ev.productId, type: 'IN', reason: 'RESTOCK', quantity: add, previousStock: stock[i]!, resultingStock: stockStart[i]!, createdAt: new Date(ev.date.getTime() - 3_600_000) });
        stock[i] = stockStart[i]!;
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

  console.log(`Insertando ${userRows.length} clientes, ${orderRows.length} pedidos, ${itemRows.length} ítems, ${movementRows.length} movimientos…`);
  await insertChunked(userRows, (c) => db.user.createMany({ data: c }));
  await insertChunked(orderRows, (c) => db.order.createMany({ data: c }));
  await insertChunked(itemRows, (c) => db.orderItem.createMany({ data: c }));
  await insertChunked(historyRows, (c) => db.orderStatusHistory.createMany({ data: c }));
  await insertChunked(movementRows, (c) => db.stockMovement.createMany({ data: c }));

  // Deja el stock final coherente con la simulación
  for (let i = 0; i < CATALOG.length; i++) {
    await db.product.update({ where: { id: prodId[i]! }, data: { stock: Math.max(0, stock[i]!) } });
  }

  const perCustomer = new Map<string, number>();
  for (const o of orderRows) if (o.paymentStatus === 'PAID') perCustomer.set(o.userId, (perCustomer.get(o.userId) ?? 0) + 1);
  const counts = [...perCustomer.values()];
  const repeat = counts.filter((c) => c >= 2).length;
  console.log('\nDataset sintético listo:');
  console.log(`  cuentas:    ${userRows.length} (${counts.length} con compras, ${(100 * repeat / Math.max(1, counts.length)).toFixed(0)}% volvió a comprar)`);
  console.log(`  compras por cliente: promedio ${(counts.reduce((a, c) => a + c, 0) / Math.max(1, counts.length)).toFixed(2)}, máximo ${Math.max(0, ...counts)}`);
  console.log(`  productos:  ${CATALOG.length}`);
  console.log(`  pedidos:    ${orderRows.length}  (~${MONTHS} meses con estacionalidad, hasta hoy)`);
  console.log('  Marcado como sintético — re-ejecuta el script para regenerar sin duplicar.\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
