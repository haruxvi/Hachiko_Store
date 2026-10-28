import type { NextRequest } from 'next/server';
import { MAX_IMAGE_BYTES, storeProductImage, type ImageUploadError } from '@/src/lib/product-image';
import { api, ApiError, limit, ok, options, requireSession } from '@/src/lib/api/v1';

export { options as OPTIONS };

const ERRORS: Record<ImageUploadError, [number, string]> = {
  STORAGE_NOT_CONFIGURED: [503, 'Este servidor no tiene almacenamiento de fotos configurado. Pega una URL https de la imagen.'],
  NO_FILE: [400, 'Elige una foto.'],
  TOO_LARGE: [413, 'La foto supera 4 MB.'],
  INVALID_TYPE: [415, 'Solo fotos JPG, PNG, WEBP, AVIF o GIF.'],
};

// Foto de producto desde la app: misma verificación (firma real del archivo,
// 4 MB) y mismo almacenamiento que el panel web. Devuelve la URL https.
export const POST = api(async (req: NextRequest) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller-upload', 40, 60_000, session.sub);
  if (Number(req.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES + 64 * 1024) {
    throw new ApiError(413, 'TOO_LARGE', ERRORS.TOO_LARGE[1]);
  }
  if (!process.env['BLOB_READ_WRITE_TOKEN']) {
    throw new ApiError(503, 'STORAGE_NOT_CONFIGURED', ERRORS.STORAGE_NOT_CONFIGURED[1]);
  }
  const form = await req.formData().catch(() => null);
  const result = await storeProductImage(form?.get('file'));
  if (!result.ok) {
    const [status, message] = ERRORS[result.code];
    throw new ApiError(status, result.code, message);
  }
  return ok({ url: result.url });
});
