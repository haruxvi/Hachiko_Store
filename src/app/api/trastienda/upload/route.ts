import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/src/lib/auth/session';
import { rateLimit, clientIpFrom } from '@/src/lib/rate-limit';
import { storeProductImage, type ImageUploadError } from '@/src/lib/product-image';

// Subida de fotos de catálogo desde el panel web. La verificación del archivo
// (tamaño, firma real) y el guardado viven en src/lib/product-image.ts.
const STATUS: Record<ImageUploadError, number> = {
  STORAGE_NOT_CONFIGURED: 503,
  NO_FILE: 400,
  TOO_LARGE: 413,
  INVALID_TYPE: 415,
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') {
    return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
  }

  const limited = await rateLimit(`upload:${clientIpFrom(request.headers)}`, 40, 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, error: { code: 'RATE_LIMITED' } },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } }
    );
  }

  // Sin token configurado ni siquiera se lee el cuerpo.
  if (!process.env['BLOB_READ_WRITE_TOKEN']) {
    return NextResponse.json({ ok: false, error: { code: 'STORAGE_NOT_CONFIGURED' } }, { status: 503 });
  }

  const form = await request.formData();
  const result = await storeProductImage(form.get('file'));
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: result.code } }, { status: STATUS[result.code] });
  }
  return NextResponse.json({ ok: true, url: result.url });
}
