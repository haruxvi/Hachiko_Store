import { describe, it, expect } from 'vitest';
import { productCard, publicImages, stockInfo } from '@/src/lib/api/dto';

const base = 'https://hachiko-store.vercel.app';

describe('API de la app: datos públicos', () => {
  it('no expone el stock exacto salvo cuando está bajo', () => {
    expect(stockInfo(120, 5)).toEqual({ stockState: 'ok', left: null });
    expect(stockInfo(4, 5)).toEqual({ stockState: 'low', left: 4 });
    expect(stockInfo(0, 5)).toEqual({ stockState: 'out', left: 0 });
    expect(stockInfo(-2, 5)).toEqual({ stockState: 'out', left: 0 });
  });

  it('la tarjeta de producto es una lista blanca (sin costo ni campos internos)', () => {
    const card = productCard(
      {
        id: 'p1', slug: 'ramen', name: 'Ramen', nameKorean: '라면', priceCLP: 2990, images: ['/productos/r.jpg'],
        stock: 50, lowStockThreshold: 5, category: { name: 'Snacks', slug: 'snacks' },
        // campos que NO deben salir:
        ...({ costCLP: 1800, archivedAt: null } as object),
      } as Parameters<typeof productCard>[0],
      base,
    );
    expect(Object.keys(card).sort()).toEqual(['category', 'id', 'image', 'left', 'name', 'nameKorean', 'priceCLP', 'slug', 'stockState'].sort());
    expect(card.image).toBe(`${base}/productos/r.jpg`);
  });

  it('solo sirve imágenes https o rutas del propio sitio', () => {
    expect(publicImages(['https://x.public.blob.vercel-storage.com/a.webp', 'javascript:alert(1)', 'http://inseguro.cl/a.png', '//cdn.cl/a.png', '/a.png'], base)).toEqual([
      'https://x.public.blob.vercel-storage.com/a.webp',
      `${base}/a.png`,
    ]);
  });
});
