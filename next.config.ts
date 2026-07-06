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
