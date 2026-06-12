import type { NextConfig } from 'next';

// El runtime de webpack en `next dev` ejecuta los chunks con eval() (source
// maps) y usa un websocket para HMR: ambos violan la CSP estricta y dejan la
// página sin hidratar (botones muertos). Estas concesiones aplican SOLO en
// desarrollo; la política de producción no cambia.
const isDev = process.env.NODE_ENV !== 'production';

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
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
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // No anunciar el framework en cada respuesta (reduce fingerprinting)
  poweredByHeader: false,
  reactStrictMode: true,
  // Hay un pnpm-lock.yaml en el directorio padre del repo; fijar la raíz
  // evita que Next infiera mal el workspace al hacer build
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        // En desarrollo /api/docs sirve Swagger UI desde unpkg y define su
        // propio CSP; el global lo rompería. En producción la ruta es 404
        // y recibe los headers globales como todo lo demás.
        source:
          process.env.NODE_ENV === 'production' ? '/(.*)' : '/((?!api/docs).*)',
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
};

export default nextConfig;
