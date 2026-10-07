"use client";

import { startTransition, useState } from "react";
import Link from "next/link";
import { importProductsFile } from "@/src/actions/product-import";
import {
  MAX_CSV_BYTES,
  type CsvCategory,
  type CsvIssue,
} from "@/src/lib/product-csv";

type Preview = {
  row: number;
  operation: "create" | "restock";
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  currentStock: number;
  resultingStock: number;
  active: boolean;
};
export default function ProductCsvImport({
  categories,
}: {
  categories: CsvCategory[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState("");
  const [issues, setIssues] = useState<CsvIssue[]>([]);
  const [preview, setPreview] = useState<Preview[]>([]);
  const [recoveredIdentifiers, setRecoveredIdentifiers] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    createdCount: number;
    restockedCount: number;
  } | null>(null);
  async function select(file?: File) {
    setFile(null);
    setFilename("");
    setIssues([]);
    setPreview([]);
    setRecoveredIdentifiers(0);
    setDone(null);
    if (!file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name) || file.size > MAX_CSV_BYTES) {
      setIssues([
        {
          row: 0,
          message: "Selecciona un archivo .csv o .xlsx de hasta 2 MB.",
        },
      ]);
      return;
    }
    setFile(file);
    setFilename(file.name);
  }
  async function submit(commit: boolean) {
    setBusy(true);
    setIssues([]);
    try {
      const result = await importProductsFile(file!, commit);
      if (!result.ok) {
        setIssues(result.issues);
        setPreview([]);
        setRecoveredIdentifiers(0);
      } else if (commit) {
        setDone({
          createdCount: result.createdCount,
          restockedCount: result.restockedCount,
        });
        setPreview([]);
        setRecoveredIdentifiers(0);
        setFile(null);
      } else {
        setPreview(result.preview ?? []);
        setRecoveredIdentifiers(
          "recoveredIdentifiers" in result
            ? (result.recoveredIdentifiers ?? 0)
            : 0,
        );
      }
    } catch {
      setIssues([
        {
          row: 0,
          message:
            "No se recibió confirmación. Valida nuevamente el archivo antes de reintentar para comprobar si se guardó.",
        },
      ]);
      setPreview([]);
      setRecoveredIdentifiers(0);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <section className="rounded-card border border-sand bg-snow p-6 space-y-4">
        <h2 className="font-display text-lg text-soot">
          1. Prepara tu archivo
        </h2>
        <div className="rounded-input border border-sand bg-cream p-4 space-y-3">
          <div>
            <h3 className="font-medium text-soot">
              Plantilla para tu catálogo
            </h3>
            <p className="mt-1 text-sm text-taupe">
              Excel con el diseño de Hachiko, instrucciones y 100 filas vacías
              para completar. El SKU se calcula automáticamente para productos
              nuevos; también puedes indicar el SKU de uno existente para sumar
              stock.
            </p>
          </div>
          <a
            href="/plantilla-productos-hachiko.xlsx"
            download
            className="btn-primary btn-sm inline-flex"
          >
            Descargar plantilla Excel
          </a>
        </div>
        <p className="text-sm text-taupe">
          Completa la plantilla Excel y súbela directamente. También se admite
          CSV UTF-8 si ya tienes uno. Máximo 1.000 productos y 2 MB por archivo.
        </p>
        <p className="text-sm text-taupe">
          Si editas un Excel, guárdalo antes de subirlo para actualizar las
          fórmulas de SKU y URL. Luego podrás validarlo y revisar los productos
          antes de guardarlos.
        </p>
        <p className="text-sm text-taupe">
          Para reponer un producto existente, escribe su SKU en la columna «SKU
          existente» y la cantidad que quieres sumar en «Stock». Puedes dejar
          vacíos los demás datos de esa fila. No se modifican el precio, el
          nombre ni las fotos del producto existente.
        </p>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-rust">
            Ver columnas y categorías
          </summary>
          <div className="mt-3 space-y-3 text-taupe">
            <p>
              <strong>Obligatorias:</strong> nombre, descripcion, categoria,
              precio_clp, stock, peso_gramos.
            </p>
            <p>
              <strong>Opcionales:</strong> sku, slug, costo_clp, stock_minimo
              (5), nombre_coreano, imagenes, activo (si), destacado (no).
            </p>
            <p>
              Precios en pesos enteros: 1990, sin $ ni puntos. Stock desde 0;
              precio y peso mayores que 0. El slug usa minúsculas, números y
              guiones, por ejemplo: ramen-picante.
            </p>
            <p>
              En imagenes puedes pegar enlaces HTTPS o rutas locales. Separa
              varias fotos con |. Puedes dejarlo vacío y agregar las fotos al
              editar el producto.
            </p>
            <p>Usa estos códigos en categoria:</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <span key={c.id} className="rounded-chip bg-cream px-3 py-1">
                  {c.name}: <code>{c.slug}</code>
                </span>
              ))}
            </div>
          </div>
        </details>
      </section>
      <section className="rounded-card border border-sand bg-snow p-6 space-y-4">
        <h2 className="font-display text-lg text-soot">
          2. Selecciona y valida
        </h2>
        <label className="block rounded-input border border-dashed border-taupe/50 bg-cream/40 p-6">
          <span className="block mb-3 text-sm font-medium">
            Archivo de productos (.csv o .xlsx)
          </span>
          <input
            aria-label="Archivo CSV o Excel"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={busy}
            onChange={(e) => void select(e.target.files?.[0])}
            className="block w-full text-sm"
          />
        </label>
        {filename && <p className="text-sm text-taupe">Archivo: {filename}</p>}
        <p className="text-xs text-taupe">
          La validación no guarda cambios. Un SKU nuevo crea el producto; un SKU
          existente suma la cantidad indicada a su stock. Si hay errores, no se
          guarda ninguna fila. Volver a importar el mismo archivo sumará stock
          nuevamente.
        </p>
        <button
          type="button"
          disabled={!file || busy}
          onClick={() => startTransition(() => submit(false))}
          className="btn-primary disabled:opacity-50"
        >
          {busy ? "Procesando…" : "Validar archivo"}
        </button>
        {!categories.length && (
          <p className="text-sm text-alert">
            Para crear productos nuevos, crea al menos una categoría activa. La
            reposición de SKU existentes sigue disponible.
          </p>
        )}
      </section>
      {issues.length > 0 && (
        <section
          role="alert"
          className="rounded-card border border-alert/30 bg-snow p-6"
        >
          <h2 className="font-medium text-alert">
            Revisa estos errores ({issues.length})
          </h2>
          <ul className="mt-3 max-h-64 overflow-auto space-y-1 text-sm">
            {issues.map((i, n) => (
              <li key={n}>
                {i.row > 0 ? `Fila ${i.row}: ` : ""}
                {i.message}
              </li>
            ))}
          </ul>
        </section>
      )}
      {preview.length > 0 && (
        <section className="rounded-card border border-sand bg-snow p-6 space-y-4">
          <h2 className="font-display text-lg">3. Confirma la importación</h2>
          <p className="text-sm text-taupe">
            {preview.length} filas válidas:{" "}
            {preview.filter((entry) => entry.operation === "create").length}{" "}
            productos nuevos y{" "}
            {preview.filter((entry) => entry.operation === "restock").length}{" "}
            reposiciones. Todavía no se han guardado.
          </p>
          {recoveredIdentifiers > 0 && (
            <p className="text-sm text-rust">
              Se regeneraron SKU o URL de {recoveredIdentifiers} productos
              porque sus fórmulas no tenían un valor válido. Revísalos antes de
              importar.
            </p>
          )}
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-sand">
                  {[
                    "Fila",
                    "SKU",
                    "Acción",
                    "Producto",
                    "Categoría",
                    "Precio",
                    "Cantidad",
                    "Stock actual → final",
                    "Estado",
                  ].map((h) => (
                    <th key={h} className="p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.row} className="border-b border-sand">
                    <td className="p-2">{p.row}</td>
                    <td className="p-2 font-mono text-xs">{p.sku}</td>
                    <td className="p-2">
                      {p.operation === "create" ? "Crear" : "Sumar stock"}
                    </td>
                    <td className="p-2">{p.name}</td>
                    <td className="p-2">{p.category}</td>
                    <td className="p-2 whitespace-nowrap">
                      ${p.price.toLocaleString("es-CL")}
                    </td>
                    <td className="p-2">{p.stock}</td>
                    <td className="p-2 whitespace-nowrap">
                      {p.currentStock} → {p.resultingStock}
                    </td>
                    <td className="p-2">{p.active ? "Activo" : "Inactivo"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            disabled={busy}
            className="btn-primary disabled:opacity-50"
            onClick={() => startTransition(() => submit(true))}
          >
            {busy ? "Importando…" : `Confirmar ${preview.length} filas`}
          </button>
        </section>
      )}
      {done !== null && (
        <section
          role="status"
          className="rounded-card border border-sand bg-butter p-6"
        >
          <h2 className="font-display text-lg">Importación completada</h2>
          <p className="mt-2 text-sm">
            Se crearon {done.createdCount} productos y se repuso el stock de{" "}
            {done.restockedCount} productos existentes.
          </p>
          <Link href="/trastienda/productos" className="btn-primary mt-4">
            Ver productos
          </Link>
        </section>
      )}
    </div>
  );
}
