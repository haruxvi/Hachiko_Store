import type { MetadataRoute } from 'next';
import { db } from '@/src/lib/db';

const APP_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';

// Sitemap dinámico: páginas públicas + catálogo vivo (productos y categorías
// activos). Las rutas privadas (cuenta, trastienda, checkout) NO van aquí
// y además están bloqueadas en robots.ts.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: APP_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${APP_URL}/catalogo`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${APP_URL}/legal/privacidad`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  try {
    const [products, categories] = await Promise.all([
      db.product.findMany({
        where: { active: true, archivedAt: null },
        select: { slug: true, updatedAt: true },
      }),
      db.category.findMany({
        where: { active: true },
        select: { slug: true },
      }),
    ]);

    return [
      ...staticPages,
      ...categories.map((c) => ({
        url: `${APP_URL}/catalogo?categoria=${c.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...products.map((p) => ({
        url: `${APP_URL}/producto/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
    ];
  } catch {
    // Sin BD disponible (p. ej. build sin entorno) el sitemap igual responde
    return staticPages;
  }
}
