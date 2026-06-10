import { NextResponse, type NextRequest } from 'next/server';
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '@/src/lib/auth/jwt';
import {
  accessCookieOptions,
  refreshCookieOptions,
  clearAuthCookies,
} from '@/src/lib/auth/session';
import { db } from '@/src/lib/db';
import { rateLimit, clientIpFrom } from '@/src/lib/rate-limit';

const REFRESH_LIMIT = 30; // por IP por minuto
const REFRESH_WINDOW_MS = 60 * 1000;

function unauthorized(code: string) {
  const response = NextResponse.json({ ok: false, error: { code } }, { status: 401 });
  for (const { name, options } of clearAuthCookies()) {
    response.cookies.set(name, '', options);
  }
  return response;
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(
    `refresh:${clientIpFrom(request.headers)}`,
    REFRESH_LIMIT,
    REFRESH_WINDOW_MS
  );
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, error: { code: 'RATE_LIMITED' } },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } }
    );
  }

  const refreshToken = request.cookies.get('hachiko_refresh')?.value;

  if (!refreshToken) {
    return NextResponse.json({ ok: false, error: { code: 'NO_REFRESH' } }, { status: 401 });
  }

  try {
    const payload = await verifyRefreshToken(refreshToken);

    // El refresh debe reflejar el estado actual del usuario: cuentas eliminadas
    // o bloqueadas no renuevan sesión, y los cambios de rol se aplican aquí
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        deletedAt: true,
        lockedUntil: true,
        tokenVersion: true,
      },
    });

    if (!user || user.deletedAt) {
      return unauthorized('INVALID_REFRESH');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return unauthorized('ACCOUNT_LOCKED');
    }
    // Tokens emitidos antes del último logout quedan revocados
    if (payload.ver !== user.tokenVersion) {
      return unauthorized('INVALID_REFRESH');
    }

    const newPayload = { sub: user.id, role: user.role, email: user.email };
    const [accessToken, newRefreshToken] = await Promise.all([
      signAccessToken(newPayload),
      signRefreshToken(newPayload, user.tokenVersion),
    ]);

    const response = NextResponse.json({ ok: true });
    const accessOpts = accessCookieOptions();
    const refreshOpts = refreshCookieOptions();

    response.cookies.set(accessOpts.name, accessToken, accessOpts.options);
    response.cookies.set(refreshOpts.name, newRefreshToken, refreshOpts.options);

    return response;
  } catch {
    return unauthorized('INVALID_REFRESH');
  }
}
