/**
 * Eventos de seguridad SINTÉTICOS en AuditLog (Fase 3).
 *
 * Genera intentos de login fallidos sobre los usuarios sintéticos existentes,
 * con patrones de ataque inyectados para poder demostrar la detección de
 * account-takeover:
 *   - Ruido: fallos aislados (tipeos) repartidos en el tiempo.
 *   - Credential stuffing: una IP atacante golpea muchas cuentas distintas.
 *   - Fuerza bruta / ATO: muchas cuentas fallidas sobre una misma cuenta,
 *     algunas seguidas de ACCOUNT_LOCKED.
 *
 * Idempotente: borra los eventos sintéticos previos (metadata.synthetic=true)
 * y regenera. No toca eventos reales. NO regenera pedidos.
 * Ejecutar:  pnpm db:seed:security
 */
import { PrismaClient, type Prisma } from '@prisma/client';

const db = new PrismaClient({ datasourceUrl: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'] });

const USER_MARK = '@seed.hachiko.test';
// IPs atacantes en rangos de documentación (TEST-NET, no ruteables).
const ATTACKER_IPS = ['203.0.113.7', '203.0.113.42', '198.51.100.23'];
const UA_BOT = 'python-requests/2.31';

const randInt = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const normalIp = () => `${randInt(1, 223)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
const daysAgo = (d: number, jitterH = 0) => new Date(Date.now() - d * 86400000 - randInt(0, jitterH) * 3600000);

async function main() {
  console.log('Limpiando eventos de seguridad sintéticos previos…');
  await db.auditLog.deleteMany({ where: { metadata: { path: ['synthetic'], equals: true } } });

  const users = await db.user.findMany({ where: { email: { endsWith: USER_MARK } }, select: { id: true } });
  if (users.length === 0) {
    console.log('No hay usuarios sintéticos. Corre primero pnpm db:seed:synthetic.');
    return;
  }
  const ids = users.map((u) => u.id);
  const rows: Prisma.AuditLogCreateManyInput[] = [];

  const fail = (userId: string, ip: string, ua: string, at: Date, pattern: string) => ({
    actorId: userId, actorRole: 'CLIENT', action: 'LOGIN_FAILED',
    targetType: 'User', targetId: userId, ip, userAgent: ua, createdAt: at,
    metadata: { synthetic: true, pattern } as Prisma.InputJsonValue,
  });

  // 1) Ruido: fallos aislados (tipeos legítimos) en los últimos 60 días
  for (let i = 0; i < 300; i++) {
    rows.push(fail(pick(ids), normalIp(), 'Mozilla/5.0', daysAgo(randInt(0, 60), 23), 'noise'));
  }

  // 2) Credential stuffing: 2 IPs atacantes golpean muchas cuentas distintas
  for (const ip of ATTACKER_IPS.slice(0, 2)) {
    const when = daysAgo(randInt(2, 8), 2);
    const targets = [...ids].sort(() => Math.random() - 0.5).slice(0, randInt(35, 60));
    for (const uid of targets) {
      for (let k = 0; k < randInt(1, 2); k++) {
        rows.push(fail(uid, ip, UA_BOT, new Date(when.getTime() + randInt(0, 120) * 60000), 'credential_stuffing'));
      }
    }
  }

  // 3) Fuerza bruta / ATO: pocas cuentas, muchos intentos, a veces bloqueo
  const victims = [...ids].sort(() => Math.random() - 0.5).slice(0, 8);
  for (const uid of victims) {
    const when = daysAgo(randInt(1, 6), 1);
    const nIps = randInt(1, 2);
    const attempts = randInt(8, 22);
    for (let k = 0; k < attempts; k++) {
      rows.push(fail(uid, pick(ATTACKER_IPS.slice(0, nIps)), UA_BOT, new Date(when.getTime() + k * randInt(1, 4) * 60000), 'brute_force'));
    }
    if (Math.random() < 0.5) {
      rows.push({
        actorId: uid, actorRole: 'CLIENT', action: 'ACCOUNT_LOCKED',
        targetType: 'User', targetId: uid, ip: pick(ATTACKER_IPS), userAgent: UA_BOT,
        createdAt: new Date(when.getTime() + attempts * 3 * 60000),
        metadata: { synthetic: true, pattern: 'brute_force' } as Prisma.InputJsonValue,
      });
    }
  }

  for (let i = 0; i < rows.length; i += 500) {
    await db.auditLog.createMany({ data: rows.slice(i, i + 500) });
  }

  console.log(`AuditLog: ${rows.length} eventos de seguridad sintéticos insertados.`);
  console.log(`  ruido + credential stuffing (${ATTACKER_IPS.slice(0, 2).join(', ')}) + fuerza bruta (${victims.length} cuentas).`);

  await seedIncidents();
}

// Incidentes de seguridad sintéticos (para la analítica de la Fase 3: tendencias
// por categoría/severidad y MTTR). Marcados con reportedBy='synthetic-seed'.
async function seedIncidents() {
  await db.securityIncident.deleteMany({ where: { reportedBy: 'synthetic-seed' } });

  const cats: Prisma.SecurityIncidentCreateManyInput['category'][] = [
    'CREDENTIAL_ABUSE', 'UNAUTHORIZED_ACCESS', 'PHISHING_IMPERSONATION',
    'COMPUTER_FRAUD', 'PERSONAL_DATA_BREACH', 'SYSTEM_INTEGRITY_ATTACK', 'OTHER',
  ];
  const sevs: Prisma.SecurityIncidentCreateManyInput['severity'][] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const resolvedStates: Prisma.SecurityIncidentCreateManyInput['status'][] = ['RESOLVED', 'CLOSED', 'REPORTED'];
  const openStates: Prisma.SecurityIncidentCreateManyInput['status'][] = ['OPEN', 'INVESTIGATING', 'CONTAINED'];

  const incidents: Prisma.SecurityIncidentCreateManyInput[] = [];
  for (let i = 0; i < 16; i++) {
    const detectedAt = daysAgo(randInt(3, 180), 23);
    const resolved = Math.random() < 0.65;
    const cat = pick(cats);
    const sev = pick(sevs);
    incidents.push({
      title: `Incidente sintético #${i + 1} — ${cat}`,
      description: 'Incidente de demostración generado para la analítica de seguridad (sintético).',
      category: cat, severity: sev,
      status: resolved ? pick(resolvedStates) : pick(openStates),
      detectedAt,
      resolvedAt: resolved ? new Date(detectedAt.getTime() + randInt(2, 240) * 3600000) : null,
      affectsPersonalData: cat === 'PERSONAL_DATA_BREACH' || Math.random() < 0.2,
      reportedBy: 'synthetic-seed',
    });
  }
  await db.securityIncident.createMany({ data: incidents });
  console.log(`SecurityIncident: ${incidents.length} incidentes sintéticos insertados.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
