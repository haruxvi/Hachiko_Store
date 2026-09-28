import { NextResponse, type NextRequest } from 'next/server';
import { put } from '@vercel/blob';
import { getSession } from '@/src/lib/auth/session';
import { rateLimit, clientIpFrom } from '@/src/lib/rate-limit';

// Subida de fotos de catálogo a Vercel Blob. El archivo pasa por esta función
// (server upload), así que se acota a 4 MB para no chocar con el límite de body
// de Vercel (~4.5 MB). Solo el vendedor puede subir.
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

// No confiamos en el Content-Type que declara el navegador (es falsificable):
// leemos los primeros bytes y verificamos la firma real del archivo. Así, si
// alguien renombra un .html o un ejecutable a .png, se rechaza. SVG queda fuera
// a propósito (puede contener <script> → XSS). Devuelve el MIME real o null.
function sniffImageMime(b: Uint8Array): keyof typeof EXT | null {
  const ascii = (start: number, s: string) =>
    [...s].every((ch, i) => b[start + i] === ch.charCodeAt(0));

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a)
    return 'image/png';
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  // GIF: "GIF87a" / "GIF89a"
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return 'image/gif';
  // WEBP: "RIFF"...."WEBP"
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
  // AVIF (ISOBMFF): "ftyp" en offset 4 y marca "avif"/"avis" en la caja ftyp
  if (ascii(4, 'ftyp') && (ascii(8, 'avif') || ascii(8, 'avis'))) return 'image/avif';
  return null;
}

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

  // Sin token configurado no hay dónde guardar: se avisa claro en vez de reventar.
  if (!process.env['BLOB_READ_WRITE_TOKEN']) {
    return NextResponse.json(
      { ok: false, error: { code: 'STORAGE_NOT_CONFIGURED' } },
      { status: 503 }
    );
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: { code: 'NO_FILE' } }, { status: 400 });
  }
  // Tamaño antes de leer a memoria: no bufferizamos archivos gigantes.
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: { code: 'TOO_LARGE' } }, { status: 413 });
  }

  // Verificación por firma real (magic bytes), no por el Content-Type declarado.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageMime(bytes);
  if (!mime) {
    return NextResponse.json({ ok: false, error: { code: 'INVALID_TYPE' } }, { status: 415 });
  }

  // Nombre aleatorio + extensión y content-type derivados de la firma real
  // (no del cliente): evita colisiones, path traversal y sorpresas de tipo.
  const blob = await put(`productos/${crypto.randomUUID()}.${EXT[mime]}`, file, {
    access: 'public',
    contentType: mime,
  });

  return NextResponse.json({ ok: true, url: blob.url });
}
