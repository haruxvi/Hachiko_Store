import { afterEach, describe, expect, it, vi } from 'vitest';

const put = vi.hoisted(() => vi.fn());
vi.mock('@vercel/blob', () => ({ put }));

import { MAX_IMAGE_BYTES, sniffImageMime, storeProductImage } from '@/src/lib/product-image';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const HTML = new TextEncoder().encode('<html><script>alert(1)</script>');
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');

afterEach(() => {
  vi.unstubAllEnvs();
  put.mockReset();
});

describe('Fotos de producto (panel web y app)', () => {
  it('reconoce la firma real del archivo', () => {
    expect(sniffImageMime(PNG)).toBe('image/png');
    expect(sniffImageMime(JPEG)).toBe('image/jpeg');
    expect(sniffImageMime(HTML)).toBeNull();
    expect(sniffImageMime(SVG)).toBeNull();
  });

  it('sin almacenamiento configurado avisa en vez de fallar', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    expect(await storeProductImage(new File([PNG], 'a.png'))).toEqual({ ok: false, code: 'STORAGE_NOT_CONFIGURED' });
  });

  it('rechaza un HTML disfrazado de .png y no lo guarda', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'token-de-prueba');
    expect(await storeProductImage(new File([HTML], 'foto.png', { type: 'image/png' }))).toEqual({ ok: false, code: 'INVALID_TYPE' });
    expect(put).not.toHaveBeenCalled();
  });

  it('rechaza fotos de más de 4 MB', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'token-de-prueba');
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'grande.jpg');
    expect(await storeProductImage(big)).toEqual({ ok: false, code: 'TOO_LARGE' });
  });

  it('guarda con nombre aleatorio y el tipo detectado (no el declarado)', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'token-de-prueba');
    put.mockResolvedValue({ url: 'https://blob.example/productos/x.png' });
    const r = await storeProductImage(new File([PNG], '../../etc/passwd.jpg', { type: 'image/jpeg' }));
    expect(r).toEqual({ ok: true, url: 'https://blob.example/productos/x.png' });
    const [path, , opts] = put.mock.calls[0]!;
    expect(path).toMatch(/^productos\/[0-9a-f-]{36}\.png$/);
    expect(opts).toMatchObject({ access: 'public', contentType: 'image/png' });
  });
});
