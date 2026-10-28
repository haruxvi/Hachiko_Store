import { randomUUID } from 'node:crypto';
import type { Role } from '@prisma/client';
import { db } from '@/src/lib/db';
import { verifyRefreshToken, signAccessToken, signRefreshToken, REFRESH_TTL_MS } from '@/src/lib/auth/jwt';

export type RotateResult =
  | { ok: true; accessToken: string; refreshToken: string; userId: string }
  | { ok: false; code: 'INVALID_REFRESH' | 'ACCOUNT_LOCKED' | 'REFRESH_RACE' };

type SessionUser = { id: string; role: Role; email: string; tokenVersion: number };

// Dos pestañas (o la app y su reintento) pueden renovar con el MISMO token casi
// a la vez. Si el segundo llega dentro de esta ventana no es un robo: se le
// responde "carrera" sin revocar, y el cliente reintenta con la cookie nueva.
const REUSE_GRACE_MS = 30_000;

/** Registra un refresh token nuevo y entrega el par access/refresh firmado. */
async function issuePair(user: SessionUser, familyId: string) {
  const jti = randomUUID();
  await db.refreshToken.create({
    data: { id: jti, userId: user.id, familyId, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  const payload = { sub: user.id, role: user.role, email: user.email };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload, user.tokenVersion, jti, familyId),
  ]);
  return { accessToken, refreshToken };
}

/** Inicio de sesión (login, registro, invitado): abre una familia de tokens nueva. */
export function issueSession(user: SessionUser) {
  return issuePair(user, randomUUID());
}

/** Revoca todos los refresh tokens de una familia (cierra ese inicio de sesión). */
export async function revokeFamily(familyId: string) {
  await db.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/**
 * Canjea un refresh token por un par nuevo (rotación). Lo usan la web (cookie)
 * y la app (cuerpo JSON), con las mismas reglas:
 *  - el refresh refleja el estado ACTUAL del usuario: cuentas eliminadas o
 *    bloqueadas no renuevan, y un cambio de rol se aplica aquí;
 *  - tokens emitidos antes del último "cerrar sesión" (tokenVersion) quedan
 *    revocados en todos los dispositivos;
 *  - cada token sirve UNA vez: si reaparece uno ya usado (fuera de la ventana
 *    de carrera), alguien lo copió y se revoca toda su familia.
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

  // Tokens anteriores al registro (sin jti): se aceptan una vez y pasan a una
  // familia registrada. Vencen solos en ≤ 7 días tras el despliegue.
  if (!payload.jti || !payload.fam) {
    const pair = await issueSession(user);
    return { ok: true, ...pair, userId: user.id };
  }

  const record = await db.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!record || record.userId !== user.id || record.familyId !== payload.fam || record.revokedAt) {
    return { ok: false, code: 'INVALID_REFRESH' };
  }

  // Consumo atómico: de dos renovaciones simultáneas con el mismo token, solo una gana.
  const { count } = await db.refreshToken.updateMany({
    where: { id: record.id, usedAt: null, revokedAt: null },
    data: { usedAt: new Date() },
  });
  if (count === 0) {
    const state = await db.refreshToken.findUnique({ where: { id: record.id }, select: { usedAt: true, revokedAt: true } });
    if (!state || state.revokedAt) return { ok: false, code: 'INVALID_REFRESH' };
    if (state.usedAt && Date.now() - state.usedAt.getTime() < REUSE_GRACE_MS) {
      return { ok: false, code: 'REFRESH_RACE' };
    }
    await revokeFamily(record.familyId);
    await db.auditLog.create({
      data: {
        actorId: user.id,
        actorRole: user.role,
        action: 'REFRESH_TOKEN_REUSE',
        targetType: 'User',
        targetId: user.id,
        metadata: { familyId: record.familyId },
      },
    });
    return { ok: false, code: 'INVALID_REFRESH' };
  }

  const pair = await issuePair(user, record.familyId);
  return { ok: true, ...pair, userId: user.id };
}

/** Limpieza diaria: los refresh tokens vencidos ya no sirven para nada. */
export async function purgeExpiredRefreshTokens(): Promise<number> {
  const { count } = await db.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}
