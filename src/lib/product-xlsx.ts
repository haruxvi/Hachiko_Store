import ExcelJS from "exceljs";
import JSZip from "jszip";
import { CSV_HEADERS, MAX_CSV_ROWS } from "@/src/lib/product-csv";

function cellText(value: ExcelJS.CellValue, blankFormula = false): string {
  if (value === null || value === undefined) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value);
  if (value instanceof Date)
    throw new Error("No uses fechas en las columnas de productos.");
  if ("error" in value)
    throw new Error(
      "El Excel contiene una fórmula con error. Corrígela y guarda el archivo.",
    );
  if ("result" in value) {
    if (value.result === undefined) {
      if (blankFormula) return "";
      throw new Error(
        "Guarda el Excel después de calcular sus fórmulas y vuelve a subirlo.",
      );
    }
    return cellText(value.result as ExcelJS.CellValue);
  }
  if ("formula" in value || "sharedFormula" in value) {
    if (blankFormula) return "";
    throw new Error(
      "Guarda el Excel después de calcular sus fórmulas y vuelve a subirlo.",
    );
  }
  if ("text" in value) return String(value.text);
  if ("richText" in value)
    return value.richText.map((part) => part.text).join("");
  throw new Error(
    "El Excel contiene una celda no compatible con la importación.",
  );
}

function csvField(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

// Headings from Hachiko-style spreadsheets can be readable instead of CSV keys.
const HEADER_ALIASES: Record<string, string> = {
  sku: "sku",
  "sku automatico": "sku",
  "codigo producto": "sku",
  slug: "slug",
  "url automatica": "slug",
  "url producto": "slug",
  nombre: "nombre",
  producto: "nombre",
  "nombre producto": "nombre",
  descripcion: "descripcion",
  detalle: "descripcion",
  categoria: "categoria",
  "categoria producto": "categoria",
  precio: "precio_clp",
  "precio clp": "precio_clp",
  "precio venta": "precio_clp",
  stock: "stock",
  "stock un": "stock",
  "stock sumar": "stock",
  cantidad: "stock",
  existencias: "stock",
  "peso g": "peso_gramos",
  "peso gramos": "peso_gramos",
  peso: "peso_gramos",
  "costo clp": "costo_clp",
  costo: "costo_clp",
  "stock minimo": "stock_minimo",
  "nombre coreano": "nombre_coreano",
  imagenes: "imagenes",
  "fotos urls": "imagenes",
  fotos: "imagenes",
  activo: "activo",
  destacado: "destacado",
};

function canonicalHeader(label: string): string {
  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return HEADER_ALIASES[normalized] ?? "";
}

// Older copies of our template use an XML namespace prefix that ExcelJS
// does not recognize. Normalize only that prefix; keep formula cached values.
async function normalizeTemplateXml(bytes: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);
  let totalXmlBytes = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !entry.name.endsWith(".xml")) continue;
    const xml = await entry.async("string");
    totalXmlBytes += xml.length;
    if (totalXmlBytes > 8 * 1024 * 1024)
      throw new Error("El Excel contiene demasiados datos.");
    if (
      xml.includes(
        'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
      )
    )
      zip.file(
        entry.name,
        xml
          .replace("xmlns:x=", "xmlns=")
          .replaceAll("<x:", "<")
          .replaceAll("</x:", "</"),
      );
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export async function productXlsxToCsv(bytes: Uint8Array): Promise<{
  csv: string;
  rowNumbers: number[];
  recoveredIdentifiers: number;
}> {
  let workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(
      Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch {
    try {
      workbook = new ExcelJS.Workbook();
      const normalized = await normalizeTemplateXml(bytes);
      await workbook.xlsx.load(
        Buffer.from(normalized) as unknown as Parameters<
          typeof workbook.xlsx.load
        >[0],
      );
    } catch {
      throw new Error(
        "No se pudo leer el XLSX. Comprueba que sea un archivo Excel válido.",
      );
    }
  }
  const required = CSV_HEADERS.slice(2, 8);
  const candidates = workbook.worksheets.flatMap((sheet) =>
    Array.from({ length: Math.min(sheet.rowCount, 10) }, (_, index) => {
      const rowNumber = index + 1;
      const row = sheet.getRow(rowNumber);
      const labels = Array.from(
        { length: Math.min(row.cellCount, 30) },
        (_, i) => {
          try {
            return cellText(row.getCell(i + 1).value, true).trim();
          } catch {
            return "";
          }
        },
      );
      const columns = labels.map(canonicalHeader);
      return {
        sheet,
        rowNumber,
        labels,
        columns,
        matches: required.filter((h) => columns.includes(h)).length,
      };
    }),
  );
  const complete = candidates.filter(
    (candidate) => candidate.matches === required.length,
  );
  const chosen =
    complete.find(
      (candidate) => candidate.sheet.name.toLowerCase() === "productos",
    ) ??
    complete.find(
      (candidate) => candidate.sheet.name.toLowerCase() === "csv",
    ) ??
    complete[0];
  if (!chosen) {
    const best = candidates.sort((a, b) => b.matches - a.matches)[0];
    const found =
      best?.labels.filter(Boolean).slice(0, 5).join(", ") || "ninguno";
    const missing = required
      .filter((name) => !best?.columns.includes(name))
      .join(", ");
    throw new Error(
      `Este Excel no tiene las columnas de productos de Hachiko. En la hoja «${best?.sheet.name ?? "sin hojas"}» encontré: ${found}. Faltan: ${missing}. Usa la plantilla Excel de esta página.`,
    );
  }
  const { sheet, rowNumber: headerRow, columns } = chosen;
  const mapped = columns
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => name);
  const lines = [mapped.map(({ name }) => csvField(name)).join(";")];
  const rowNumbers: number[] = [];
  let recoveredIdentifiers = 0;
  let count = 0;
  for (
    let rowNumber = headerRow + 1;
    rowNumber <= sheet.rowCount;
    rowNumber++
  ) {
    const row = sheet.getRow(rowNumber);
    const values = mapped.map(({ index }) => row.getCell(index + 1).value);
    let recoveredInRow = false;
    const cells = values.map((value, index) => {
      try {
        return cellText(value, true);
      } catch (error) {
        // These two values are optional; the CSV parser can generate them from
        // the product name and category when spreadsheet formulas break.
        if (["sku", "slug"].includes(mapped[index]!.name)) {
          recoveredInRow = true;
          return "";
        }
        const address = row.getCell(mapped[index]!.index + 1).address;
        throw new Error(
          `Hoja «${sheet.name}», celda ${address}: ${(error as Error).message}`,
        );
      }
    });
    if (!cells.some((value) => value.trim())) continue;
    if (recoveredInRow) recoveredIdentifiers++;
    if (++count > MAX_CSV_ROWS)
      throw new Error(`Máximo ${MAX_CSV_ROWS} productos por archivo.`);
    lines.push(cells.map(csvField).join(";"));
    rowNumbers.push(rowNumber);
  }
  return { csv: lines.join("\r\n") + "\r\n", rowNumbers, recoveredIdentifiers };
}
