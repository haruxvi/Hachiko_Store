import { describe, it, expect } from 'vitest';
import { safeImageUrl } from '@/src/lib/image-url';

describe('safeImageUrl', () => {
  it('acepta imágenes https (p. ej. Vercel Blob) y las normaliza', () => {
    expect(safeImageUrl(' https://abc.public.blob.vercel-storage.com/productos/x.webp ')).toBe(
      'https://abc.public.blob.vercel-storage.com/productos/x.webp',
    );
  });

  it.each([
    ['javascript:alert(1)'],
    ['JAVASCRIPT:alert(1)'],
    ['data:image/svg+xml,<svg onload=alert(1)>'],
    ['http://sitio-sin-cifrar.cl/a.png'],
    ['https://usuario:clave@sitio.cl/a.png'],
    ['//sitio.cl/a.png'],
    ['no es una url'],
    [''],
  ])('rechaza %s', (raw) => {
    expect(safeImageUrl(raw)).toBeNull();
  });
});
