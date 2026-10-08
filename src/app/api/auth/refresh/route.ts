import { NextResponse, type NextRequest } from 'next/server';
import { rotateRefreshToken } from '@/src/lib/auth/rotate';
import {
  accessCookieOptions,
  refreshCookieOptions,
  clearAuthCookies,
} from '@/src/lib/auth/session';
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

  const refreshToken = request.cookies.get('hachiko_refresh')?.value;

  if (!refreshToken) {
    return NextResponse.json({ ok: false, error: { code: 'NO_REFRESH' } }, { status: 401 });
  }

  try {
    // Misma lógica que la app nativa (src/lib/auth/rotate.ts).
    const result = await rotateRefreshToken(refreshToken);
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
