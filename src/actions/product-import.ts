"use server";

import { getSession } from "@/src/lib/auth/session";
import { importProductsCsvAs, importProductsUpload } from "@/src/lib/product-import";

// La lógica de la carga masiva vive en src/lib/product-import.ts (la comparte
// la API de la app); aquí solo se verifica la sesión del panel web.

const NOT_SELLER = {
  ok: false as const,
  issues: [{ row: 0, message: "Debes iniciar sesión como vendedor." }],
};

export async function importProductsFile(file: File, commit = false) {
  const session = await getSession();
  if (!session || session.role !== "SELLER") return NOT_SELLER;
  if (
    !file ||
    typeof file.name !== "string" ||
    typeof file.arrayBuffer !== "function" ||
    typeof commit !== "boolean"
  )
    return {
      ok: false as const,
      issues: [{ row: 0, message: "Selecciona un archivo CSV o XLSX válido." }],
    };
  return importProductsUpload(
    session.sub,
    { name: file.name, size: file.size, read: async () => new Uint8Array(await file.arrayBuffer()) },
    commit,
  );
}

export async function importProductsCsv(csv: string, commit = false) {
  const session = await getSession();
  if (!session || session.role !== "SELLER") return NOT_SELLER;
  if (typeof csv !== "string" || typeof commit !== "boolean")
    return {
      ok: false as const,
      issues: [{ row: 0, message: "Solicitud inválida." }],
    };
  return importProductsCsvAs(session.sub, csv, commit);
}
