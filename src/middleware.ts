import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken } from '@/src/lib/auth/jwt';

const PANEL_PREFIX = '/trastienda';
const ACCOUNT_PREFIXES = ['/perfil', '/pedidos', '/datos'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('hachiko_access')?.value;
  let payload = null;

  if (token) {
    try {
      payload = await verifyAccessToken(token);
    } catch {
      // expired or invalid
    }
  }

  // Panel routes — require SELLER or ADMIN
  if (pathname.startsWith(PANEL_PREFIX)) {
    if (!payload || !['SELLER', 'ADMIN'].includes(payload.role)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // /clientes — only ADMIN
    if (pathname.includes('/clientes') && payload.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/trastienda/ordenes', request.url));
    }
  }

  // Account routes — require any authenticated user
  if (ACCOUNT_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!payload) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Already logged in → redirect away from login/register
  if (['/login', '/registro'].includes(pathname) && payload) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    '/trastienda/:path*',
    '/perfil/:path*',
    '/pedidos/:path*',
    '/datos/:path*',
    '/login',
    '/registro',
  ],
};
