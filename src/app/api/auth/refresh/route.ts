import { NextResponse, type NextRequest } from 'next/server';
import { rotateRefreshToken } from '@/src/lib/auth/rotate';
import {
  accessCookieOptions,
  refreshCookieOptions,
  clearAuthCookies,
  REFRESH_COOKIE_NAME,
} from '@/src/lib/auth/session';
import { rateLimit, clientIpFrom } from '@/src/lib/rate-limit';

const REFRESH_LIMIT = 30; // por IP por minuto
const REFRESH_WINDOW_MS = 60 * 1000;

function unauthorized(code: string) {
  return clearAuthCookies(NextResponse.json({ ok: false, error: { code } }, { status: 401 }));
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(
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

  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    return NextResponse.json({ ok: false, error: { code: 'NO_REFRESH' } }, { status: 401 });
  }

  try {
    // Misma lógica que la app nativa (src/lib/auth/rotate.ts).
    const result = await rotateRefreshToken(refreshToken);
    // Otra pestaña renovó con este mismo token hace un instante: NO se borran
    // las cookies (ya traen el par nuevo que dejó esa pestaña).
    if (!result.ok && result.code === 'REFRESH_RACE') {
      return NextResponse.json({ ok: false, error: { code: 'REFRESH_RACE' } }, { status: 409 });
    }
    if (!result.ok) return unauthorized(result.code);

    const response = NextResponse.json({ ok: true });
    const accessOpts = accessCookieOptions();
    const refreshOpts = refreshCookieOptions();

    response.cookies.set(accessOpts.name, result.accessToken, accessOpts.options);
    response.cookies.set(refreshOpts.name, result.refreshToken, refreshOpts.options);

    return response;
  } catch {
    return unauthorized('INVALID_REFRESH');
  }
}
