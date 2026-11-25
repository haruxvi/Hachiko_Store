/**
 * Sella con clave (HMAC) las incidencias registradas antes del sellado.
 *
 * Desde 2026-11 cada incidencia guarda un sello de su bitácora (largo + hash del
 * último evento, firmado con una clave derivada de DATA_ENCRYPTION_KEY). Las
 * incidencias anteriores no lo tienen: la aplicación las muestra "Sin sello" y no
 * deja agregarles eventos. Este script las sella UNA vez, después de aplicar el
 * esquema (prisma db push) en esa base.
 *
 * Solo sella bitácoras cuya cadena SHA-256 verifica; una cadena rota se informa y
 * NO se sella (sellarla escondería la manipulación). Es idempotente: nunca toca
 * una incidencia que ya tiene sello.
 *
 *   pnpm db:seal-incidents           # simulación: muestra qué haría
 *   pnpm db:seal-incidents --apply   # escribe los sellos
 */
import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { sealChainHead, verifyChain } from '../src/lib/crypto/integrity';

// En local la clave viene del .env; en Docker/CI ya está en el entorno.
if (!process.env['DATA_ENCRYPTION_KEY'] && existsSync('.env')) process.loadEnvFile('.env');

const db = new PrismaClient();
const apply = process.argv.includes('--apply');

async function main() {
  const incidents = await db.securityIncident.findMany({
    where: { chainSeal: null },
    include: { events: { orderBy: { seq: 'asc' } } },
    orderBy: { incidentNumber: 'asc' },
  });

  let sealed = 0;
  const broken: string[] = [];
  for (const incident of incidents) {
    const chain = verifyChain(incident.events);
    if (!chain.valid) {
      broken.push(`#${incident.incidentNumber} (cadena rota en el evento ${chain.brokenAtSeq})`);
      continue;
    }
    const length = incident.events.length;
    const head = length ? incident.events[length - 1]!.hash : null;
    if (apply) {
      const { count } = await db.securityIncident.updateMany({
        where: { id: incident.id, chainSeal: null },
        data: { chainLength: length, chainHead: head, chainSeal: sealChainHead(incident.id, length, head) },
      });
      if (count === 0) continue;
      await db.auditLog.create({
        data: {
          action: 'INCIDENT_CHAIN_SEALED',
          targetType: 'SecurityIncident',
          targetId: incident.id,
          metadata: { incidentNumber: incident.incidentNumber, events: length },
        },
      });
    }
    sealed += 1;
  }

  console.log(`Incidencias sin sello: ${incidents.length}`);
  console.log(`${apply ? 'Selladas' : 'Se sellarían'}: ${sealed}`);
  if (broken.length) {
    console.log(`Con la cadena rota, NO se sellan (revisar a mano): ${broken.join(', ')}`);
  }
  if (!apply) console.log('Simulación: agrega --apply para escribir los sellos.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
