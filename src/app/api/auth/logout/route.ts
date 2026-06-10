import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/src/lib/auth/session';
import { writeAudit } from '@/src/lib/services/audit.service';
import { getSession } from '@/src/lib/auth/session';
import { db } from '@/src/lib/db';

export async function POST() {
  const session = await getSession();

  if (session) {
    // Incrementar tokenVersion revoca todos los refresh tokens del usuario
    // (cierra la sesión en todos los dispositivos, no solo en este)
    await Promise.all([
      db.user
        .update({
          where: { id: session.sub },
          data: { tokenVersion: { increment: 1 } },
        })
        .catch(() => null),
      writeAudit({ actorId: session.sub, actorRole: session.role, action: 'LOGOUT' }),
    ]);
  }

  const response = NextResponse.json({ ok: true });
  for (const { name, options } of clearAuthCookies()) {
    response.cookies.set(name, '', options);
  }

  return response;
}
