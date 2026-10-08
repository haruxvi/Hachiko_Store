import { db } from '@/src/lib/db';
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '@/src/lib/auth/jwt';

export type RotateResult =
  | { ok: true; accessToken: string; refreshToken: string; userId: string }
  | { ok: false; code: 'INVALID_REFRESH' | 'ACCOUNT_LOCKED' };

/**
 * Canjea un refresh token por un par nuevo (rotación). Lo usan la web (cookie)
 * y la app (cuerpo JSON), con las mismas reglas:
 *  - el refresh refleja el estado ACTUAL del usuario: cuentas eliminadas o
 *    bloqueadas no renuevan, y un cambio de rol se aplica aquí;
 *  - tokens emitidos antes del último "cerrar sesión" (tokenVersion) quedan
 *    revocados en todos los dispositivos.
 */
export async function rotateRefreshToken(refreshToken: string): Promise<RotateResult> {
  let payload;
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch {
    return { ok: false, code: 'INVALID_REFRESH' };
  }

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, deletedAt: true, lockedUntil: true, tokenVersion: true },
  });
  if (!user || user.deletedAt) return { ok: false, code: 'INVALID_REFRESH' };
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false, code: 'ACCOUNT_LOCKED' };
  if (payload.ver !== user.tokenVersion) return { ok: false, code: 'INVALID_REFRESH' };

  const next = { sub: user.id, role: user.role, email: user.email };
  const [accessToken, newRefresh] = await Promise.all([
    signAccessToken(next),
    signRefreshToken(next, user.tokenVersion),
  ]);
  return { ok: true, accessToken, refreshToken: newRefresh, userId: user.id };
}
