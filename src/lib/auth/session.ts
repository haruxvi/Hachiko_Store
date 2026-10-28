import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { verifyAccessToken, type JWTPayload } from './jwt';

const ACCESS_COOKIE = 'hachiko_access';
const REFRESH_COOKIE = 'hachiko_refresh';

export async function getSession(): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!token) return null;
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
}

export function accessCookieOptions() {
  return {
    name: ACCESS_COOKIE,
    options: {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict' as const,
      maxAge: 15 * 60,
      path: '/',
    },
  };
}

export function refreshCookieOptions() {
  return {
    name: REFRESH_COOKIE,
    options: {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict' as const,
      maxAge: 7 * 24 * 60 * 60,
      // Solo viaja a /api/auth/* (refresh y logout), nunca al resto del sitio.
      // Logout lo necesita para revocar la sesión aunque el access ya venció.
      path: REFRESH_COOKIE_PATH,
    },
  };
}

const REFRESH_COOKIE_PATH = '/api/auth';
// Ruta anterior de la cookie de refresh: se sigue borrando al cerrar sesión para
// que no queden cookies huérfanas en navegadores con sesiones antiguas.
const LEGACY_REFRESH_COOKIE_PATH = '/api/auth/refresh';

export const REFRESH_COOKIE_NAME = REFRESH_COOKIE;

/**
 * Borra las cookies de sesión en la respuesta. `response.cookies` guarda una
 * cookie por NOMBRE, así que la de la ruta antigua se agrega directo como
 * header (y al final: un `cookies.set` posterior reescribiría los headers).
 */
export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set(ACCESS_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(REFRESH_COOKIE, '', { maxAge: 0, path: REFRESH_COOKIE_PATH });
  response.headers.append(
    'Set-Cookie',
    `${REFRESH_COOKIE}=; Path=${LEGACY_REFRESH_COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=Strict`,
  );
  return response;
}
