import type { NextConfig } from 'next';

// La Content-Security-Policy se define en el middleware (src/middleware.ts) con
// un nonce por request, lo que permite quitar 'unsafe-inline' de script-src.
// Aquí quedan solo los headers estáticos que no dependen del request.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
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
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Service worker de la PWA: nunca en caché del navegador ni del CDN, para
        // que una versión corregida llegue a todos en la siguiente visita.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [],
  },
  // Solo afecta a `next dev` (p. ej. el stack de Docker local): Next 16 bloquea los
  // recursos de desarrollo pedidos desde orígenes distintos de "localhost", y
  // Docker Desktop abre el sitio como 127.0.0.1. Sin esto, el JS no termina de
  // cargar y los formularios (login incluido) no funcionan en esa dirección.
  // DEV_ALLOWED_ORIGINS (opcional, separado por comas) lo fija la demo en red
  // local (scripts/demo-lan.mjs) con la IP del PC, para que un teléfono en el
  // mismo Wi-Fi pueda abrir el sitio de desarrollo (p. ej. el checkout).
  allowedDevOrigins: [
    '127.0.0.1',
    ...(process.env['DEV_ALLOWED_ORIGINS'] ?? '').split(',').map((o) => o.trim()).filter(Boolean),
  ],
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
      bodySizeLimit: '3mb',
    },
  },
};

export default nextConfig;
