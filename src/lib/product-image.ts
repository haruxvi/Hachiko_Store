import { put } from '@vercel/blob';

// Subida de fotos de catálogo a Vercel Blob, compartida por el panel web y la
// API v1 de la app. El archivo pasa por la función (server upload), así que se
// acota a 4 MB para no chocar con el límite de body de Vercel (~4.5 MB).
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

// No confiamos en el Content-Type que declara el cliente (es falsificable):
// leemos los primeros bytes y verificamos la firma real del archivo. Así, si
// alguien renombra un .html o un ejecutable a .png, se rechaza. SVG queda fuera
// a propósito (puede contener <script> → XSS). Devuelve el MIME real o null.
export function sniffImageMime(b: Uint8Array): keyof typeof EXT | null {
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

export type ImageUploadError = 'STORAGE_NOT_CONFIGURED' | 'NO_FILE' | 'TOO_LARGE' | 'INVALID_TYPE';

export async function storeProductImage(file: unknown): Promise<{ ok: true; url: string } | { ok: false; code: ImageUploadError }> {
  // Sin token configurado no hay dónde guardar: se avisa claro en vez de reventar.
  if (!process.env['BLOB_READ_WRITE_TOKEN']) return { ok: false, code: 'STORAGE_NOT_CONFIGURED' };
  if (!(file instanceof File)) return { ok: false, code: 'NO_FILE' };
  // Tamaño antes de leer a memoria: no bufferizamos archivos gigantes.
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, code: 'TOO_LARGE' };

  // Verificación por firma real (magic bytes), no por el Content-Type declarado.
  const mime = sniffImageMime(new Uint8Array(await file.arrayBuffer()));
  if (!mime) return { ok: false, code: 'INVALID_TYPE' };

  // Nombre aleatorio + extensión y content-type derivados de la firma real
  // (no del cliente): evita colisiones, path traversal y sorpresas de tipo.
  const blob = await put(`productos/${crypto.randomUUID()}.${EXT[mime]}`, file, {
    access: 'public',
    contentType: mime,
  });
  return { ok: true, url: blob.url };
}
