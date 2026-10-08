import type { NextRequest } from 'next/server';
import { db } from '@/src/lib/db';
import { writeAudit } from '@/src/lib/services/audit.service';
import { api, bearerSession, ok, options } from '@/src/lib/api/v1';

export { options as OPTIONS };

// Cerrar sesión revoca TODOS los refresh tokens del usuario (tokenVersion + 1),
// igual que en la web. La app además borra los tokens del llavero.
export const POST = api(async (req: NextRequest) => {
  const session = await bearerSession(req);
  if (session) {
    await Promise.all([
      db.user.update({ where: { id: session.sub }, data: { tokenVersion: { increment: 1 } } }).catch(() => null),
      writeAudit({ actorId: session.sub, actorRole: session.role, action: 'LOGOUT', metadata: { client: 'app' } }),
    ]);
  }
  return ok({ loggedOut: true });
});
