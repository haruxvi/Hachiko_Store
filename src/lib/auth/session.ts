import { cookies } from 'next/headers';
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
      path: '/api/auth/refresh',
    },
  };
}

export function clearAuthCookies() {
  return [
    { name: ACCESS_COOKIE, options: { maxAge: 0, path: '/' } },
    { name: REFRESH_COOKIE, options: { maxAge: 0, path: '/api/auth/refresh' } },
  ];
}
