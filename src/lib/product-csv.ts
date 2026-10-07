import { ProductSchema } from "@/src/lib/validation/schemas";

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_ROWS = 1000;
export const CSV_HEADERS = [
  "sku",
  "slug",
  "nombre",
  "descripcion",
  "categoria",
  "precio_clp",
  "stock",
  "peso_gramos",
  "costo_clp",
  "stock_minimo",
  "nombre_coreano",
  "imagenes",
  "activo",
  "destacado",
];
const REQUIRED = CSV_HEADERS.slice(2, 8);
export type CsvCategory = { id: string; name: string; slug: string };
export type CsvIssue = { row: number; message: string };
export type CsvProduct = ReturnType<typeof ProductSchema.parse>;
export type CsvRow =
  | { row: number; kind: "product"; product: CsvProduct; categoryName: string }
  | { row: number; kind: "restock"; sku: string; quantity: number };

function categoryKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// RFC-style quoted fields, including embedded separators, newlines and escaped quotes.
function readCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const pushField = () => {
    row.push(field.trim());
    field = "";
    closed = false;
  };
  const pushRow = () => {
    pushField();
    if (row.some(Boolean)) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else field += c;
    } else if (c === delimiter) pushField();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (c === '"' || (closed && c.trim()))
      throw new Error("Comillas incorrectas en el CSV.");
    else if (!closed) field += c;
    if (rows.length > MAX_CSV_ROWS + 1)
      throw new Error(`Máximo ${MAX_CSV_ROWS} productos por archivo.`);
  }
  if (quoted) throw new Error("Hay un campo con comillas sin cerrar.");
  if (field || row.length || closed) pushRow();
  return rows;
}

// Deterministic identifiers keep preview, confirmation and retries consistent.
function automaticIdentifiers(name: string, category: string) {
  const key =
    name.normalize("NFKC").trim().toLowerCase() + "|" + category.toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++)
    hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  const suffix = (hash >>> 0).toString(16).padStart(8, "0");
  const base =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80)
      .replace(/-$/, "") || "producto";
  return { sku: "AUTO-" + suffix.toUpperCase(), slug: base + "-" + suffix };
}

export function parseProductCsv(
  csv: string,
  categories: CsvCategory[],
): { rows: CsvRow[]; issues: CsvIssue[] } {
  const rows: CsvRow[] = [],
    issues: CsvIssue[] = [];
  if (new TextEncoder().encode(csv).length > MAX_CSV_BYTES)
    return { rows, issues: [{ row: 1, message: "El CSV supera 2 MB." }] };
  let table: string[][];
  try {
    const text = csv.replace(/^\uFEFF/, "");
    // Headers never contain separators inside quotes in our documented format.
    const header = text.split(/\r?\n/, 1)[0] ?? "";
    table = readCsv(text, header.includes(";") ? ";" : ",");
  } catch (e) {
    return { rows, issues: [{ row: 1, message: (e as Error).message }] };
  }
  const headers = table.shift()?.map((h) => h.toLowerCase()) ?? [];
  if (new Set(headers).size !== headers.length)
    issues.push({ row: 1, message: "Hay columnas repetidas." });
  const fullProduct = REQUIRED.every((header) => headers.includes(header));
  const stockOnly = headers.includes("sku") && headers.includes("stock");
  if (!fullProduct && !stockOnly)
    issues.push({
      row: 1,
      message:
        "Incluye las columnas de productos o, para reponer stock, sku y stock.",
    });
  for (const h of headers)
    if (!CSV_HEADERS.includes(h))
      issues.push({ row: 1, message: `Columna desconocida: ${h}.` });
  if (!table.length)
    issues.push({ row: 1, message: "El archivo no contiene productos." });
  if (table.length > MAX_CSV_ROWS)
    issues.push({
      row: 1,
      message: `Máximo ${MAX_CSV_ROWS} productos por archivo.`,
    });
  if (issues.length) return { rows, issues };
  const skus = new Set<string>(),
    slugs = new Set<string>();
  table.forEach((cells, index) => {
    const row = index + 2;
    const start = issues.length;
    if (cells.length !== headers.length) {
      issues.push({
        row,
        message: "La cantidad de columnas no coincide con el encabezado.",
      });
      return;
    }
    const values = Object.fromEntries(
      headers.map((h, i) => [h, cells[i] ?? ""]),
    );
    const value = (key: string) => values[key] ?? "";
    const integer = (key: string, fallback?: number) => {
      if (!value(key) && fallback !== undefined) return fallback;
      if (!/^\d+$/.test(value(key)) || Number(value(key)) > 2147483647) {
        issues.push({
          row,
          message: `${key}: usa un entero sin puntos, signos ni decimales.`,
        });
        return 0;
      }
      return Number(value(key));
    };
    const restockOnly =
      stockOnly &&
      (!fullProduct ||
        [
          "nombre",
          "descripcion",
          "categoria",
          "precio_clp",
          "peso_gramos",
        ].every((key) => !value(key)));
    if (restockOnly) {
      const sku = value("sku");
      const quantity = integer("stock");
      if (!sku || sku.length > 50)
        issues.push({
          row,
          message: "Para reponer stock, indica un SKU válido.",
        });
      if (quantity <= 0)
        issues.push({
          row,
          message: "La cantidad a sumar debe ser mayor que 0.",
        });
      if (skus.has(sku.toLowerCase()))
        issues.push({ row, message: `SKU repetido en el archivo: ${sku}.` });
      skus.add(sku.toLowerCase());
      if (issues.length === start)
        rows.push({ row, kind: "restock", sku, quantity });
      return;
    }
    const boolean = (key: string, fallback: boolean) => {
      const v = value(key).toLowerCase();
      if (!v) return fallback;
      if (["true", "1", "si", "sí"].includes(v)) return true;
      if (["false", "0", "no"].includes(v)) return false;
      issues.push({ row, message: `${key}: usa si/no o true/false.` });
      return fallback;
    };
    const selectedCategory = categoryKey(value("categoria"));
    const category = categories.find(
      (c) =>
        categoryKey(c.slug) === selectedCategory ||
        categoryKey(c.name) === selectedCategory,
    );
    if (!category)
      issues.push({
        row,
        message: `Categoría no disponible: ${value("categoria")}. Usa su código de la lista.`,
      });
    const images = value("imagenes")
      ? value("imagenes")
          .split("|")
          .map((s) => s.trim())
      : [];
    if (
      images.some((s) => {
        if (/^\/(?!\/)/.test(s) && !/[\\\s]/.test(s)) return false;
        try {
          const u = new URL(s);
          return u.protocol !== "https:" || !!u.username || !!u.password;
        } catch {
          return true;
        }
      })
    )
      issues.push({
        row,
        message:
          "imagenes: usa URLs HTTPS o rutas locales que empiecen por /; separa varias con |.",
      });
    const automatic = automaticIdentifiers(
      value("nombre"),
      category?.slug ?? value("categoria"),
    );
    const sku = value("sku") || automatic.sku;
    const slug = value("slug") || automatic.slug;
    const parsed = ProductSchema.safeParse({
      sku,
      slug,
      name: value("nombre"),
      description: value("descripcion"),
      categoryId: category?.id,
      priceCLP: integer("precio_clp"),
      stock: integer("stock"),
      weightGrams: integer("peso_gramos"),
      costCLP: value("costo_clp") ? integer("costo_clp") : undefined,
      lowStockThreshold: integer("stock_minimo", 5),
      nameKorean: value("nombre_coreano") || undefined,
      images,
      active: boolean("activo", true),
      featured: boolean("destacado", false),
    });
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        issues.push({
          row,
          message: `${issue.path.join(".")}: ${issue.message}`,
        });
    if (skus.has(sku.toLowerCase()))
      issues.push({
        row,
        message: `SKU repetido en el archivo: ${sku}.`,
      });
    if (slugs.has(slug))
      issues.push({
        row,
        message: `Slug repetido en el archivo: ${slug}.`,
      });
    skus.add(sku.toLowerCase());
    slugs.add(slug);
    if (parsed.success && issues.length === start)
      rows.push({
        row,
        kind: "product",
        product: parsed.data,
        categoryName: category!.name,
      });
  });
  return { rows, issues };
}
