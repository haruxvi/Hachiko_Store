import { safeImageUrl } from '@/src/lib/image-url';

// Formas públicas de los datos que viajan a la app. Se arman a mano (lista
// blanca) para que nunca salga un campo interno por accidente: el costo, el
// stock exacto (salvo cuando está bajo), notas internas, etc.

export type StockState = 'ok' | 'low' | 'out';

type ProductLike = {
  id: string;
  slug: string;
  name: string;
  nameKorean: string | null;
  priceCLP: number;
  images: string[];
  stock: number;
  lowStockThreshold: number;
  category?: { name: string; slug: string } | null;
};

/** Imágenes servibles en la app: https (Vercel Blob, etc.) o rutas del sitio hechas absolutas. */
export function publicImages(images: string[], base: string): string[] {
  return images
    .map((src) => (src.startsWith('/') && !src.startsWith('//') ? new URL(src, base).toString() : safeImageUrl(src)))
    .filter((u): u is string => !!u)
    .slice(0, 10);
}

export function stockInfo(available: number, threshold: number): { stockState: StockState; left: number | null } {
  if (available <= 0) return { stockState: 'out', left: 0 };
  if (available <= threshold) return { stockState: 'low', left: available };
  return { stockState: 'ok', left: null };
}

export function productCard(p: ProductLike, base: string, available = p.stock) {
  const images = publicImages(p.images, base);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    nameKorean: p.nameKorean,
    priceCLP: p.priceCLP,
    image: images[0] ?? null,
    category: p.category ? { name: p.category.name, slug: p.category.slug } : null,
    ...stockInfo(available, p.lowStockThreshold),
  };
}

export type ProductCardDto = ReturnType<typeof productCard>;

/** Origen público del sitio, para volver absolutas las rutas de imágenes. */
export function siteOrigin(reqUrl: string): string {
  return process.env['NEXT_PUBLIC_APP_URL'] ?? new URL(reqUrl).origin;
}
