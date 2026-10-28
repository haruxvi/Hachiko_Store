import type { NextRequest } from 'next/server';
import { MAX_CSV_BYTES } from '@/src/lib/product-csv';
import { importProductsUpload } from '@/src/lib/product-import';
import { api, ApiError, limit, ok, options, requireSession } from '@/src/lib/api/v1';

export { options as OPTIONS };

// Carga masiva desde la app: mismo archivo (CSV o XLSX de la plantilla), misma
// revisión de seguridad y misma transacción que el panel web. Sin `confirmar=1`
// solo valida y devuelve la vista previa; con él, guarda todo o nada.
export const POST = api(async (req: NextRequest) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller-write', 30, 60_000, session.sub);
  // Margen para los encabezados del multipart; el archivo en sí se vuelve a medir.
  if (Number(req.headers.get('content-length') ?? 0) > MAX_CSV_BYTES + 64 * 1024) {
    throw new ApiError(413, 'TOO_LARGE', 'El archivo supera 2 MB.');
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || !file.name) throw new ApiError(400, 'NO_FILE', 'Selecciona un archivo .csv o .xlsx.');
  const commit = form?.get('confirmar') === '1';

  const result = await importProductsUpload(
    session.sub,
    { name: file.name, size: file.size, read: async () => new Uint8Array(await file.arrayBuffer()) },
    commit,
  );
  // Las observaciones por fila son parte de la respuesta (no un error de la API).
  return ok(result);
});
