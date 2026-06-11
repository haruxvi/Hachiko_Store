import type { MetadataRoute } from 'next';

const APP_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Rutas privadas u operativas: sin valor para buscadores y mejor fuera
      // de los índices
      disallow: [
        '/api/',
        '/trastienda',
        '/perfil',
        '/pedidos',
        '/datos',
        '/checkout',
        '/carrito',
        '/restablecer',
        '/verificar-email',
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
