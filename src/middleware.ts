import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken } from '@/src/lib/auth/jwt';

const PANEL_PREFIX = '/trastienda';
const ACCOUNT_PREFIXES = ['/perfil', '/pedidos', '/datos'];

// En dev el runtime de webpack usa eval() (source maps) y un websocket para HMR;
// ambos solo se permiten en desarrollo. En producción la política no se relaja.
const isDev = process.env.NODE_ENV !== 'production';

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic' + nonce: solo corren los scripts que Next firma con el
    // nonce de esta respuesta. Se elimina 'unsafe-inline', que dejaba ejecutar
    // cualquier <script> inyectado (XSS).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
    "font-src 'self' fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self' webpay3g.transbank.cl api.mercadopago.com${isDev ? ' ws://localhost:3000' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    // El checkout hace POST del token_ws directo a Transbank (prod e integración)
    "form-action 'self' webpay3g.transbank.cl webpay3gint.transbank.cl",
    'upgrade-insecure-requests',
  ].join('; ');
}

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

  // Panel routes — solo SELLER
  if (pathname.startsWith(PANEL_PREFIX)) {
    if (!payload || payload.role !== 'SELLER') {
      return NextResponse.redirect(new URL('/login', request.url));
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

  // Nonce por request para la CSP. btoa/getRandomValues funcionan en Edge
  // (no hay Buffer). Se pasa a la request para que Next lo aplique a SUS
  // scripts, y a la response para que el navegador lo exija.
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Security headers
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  // Se ejecuta en todas las páginas HTML (para inyectar la CSP con nonce),
  // excluyendo API, assets estáticos de Next y archivos con extensión.
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
