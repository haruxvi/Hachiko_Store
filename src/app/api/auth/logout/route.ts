import { NextResponse, type NextRequest } from 'next/server';
import { clearAuthCookies, getSession, REFRESH_COOKIE_NAME } from '@/src/lib/auth/session';
import { verifyRefreshToken, type JWTPayload } from '@/src/lib/auth/jwt';
import { writeAudit } from '@/src/lib/services/audit.service';
import { db } from '@/src/lib/db';

export async function POST(request: NextRequest) {
  // Se identifica al usuario por el access token o, si ya venció (pestaña
  // abierta más de 15 min), por el refresh token. Antes, con el access vencido,
  // el logout borraba las cookies pero el refresh seguía siendo válido en el
  // servidor: quien lo hubiera copiado podía seguir renovando la sesión.
  let who: JWTPayload | null = await getSession();
  if (!who) {
    const refresh = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
    if (refresh) who = await verifyRefreshToken(refresh).catch(() => null);
  }

  if (who) {
    // Incrementar tokenVersion revoca todos los refresh tokens del usuario
    // (cierra la sesión en todos los dispositivos, no solo en este)
    await Promise.all([
      db.user
        .update({
          where: { id: who.sub },
          data: { tokenVersion: { increment: 1 } },
        })
        .catch(() => null),
      writeAudit({ actorId: who.sub, actorRole: who.role, action: 'LOGOUT' }),
    ]);
  }

  return clearAuthCookies(NextResponse.json({ ok: true }));
}
