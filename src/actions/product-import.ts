"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/src/lib/auth/session";
import { db } from "@/src/lib/db";
import {
  MAX_CSV_BYTES,
  parseProductCsv,
  type CsvIssue,
  type CsvRow,
} from "@/src/lib/product-csv";

type ExistingProduct = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  stock: number;
  priceCLP: number;
  active: boolean;
  archivedAt: Date | null;
  category: { name: string };
};

const existingSelect = {
  id: true,
  sku: true,
  slug: true,
  name: true,
  stock: true,
  priceCLP: true,
  active: true,
  archivedAt: true,
  category: { select: { name: true } },
} as const;

function planRows(rows: CsvRow[], existing: ExistingProduct[]) {
  const bySku = new Map(existing.map((p) => [p.sku.toLowerCase(), p]));
  const bySlug = new Map(existing.map((p) => [p.slug, p]));
  const issues: CsvIssue[] = [];
  const entries: Array<
    | { operation: "create"; row: Extract<CsvRow, { kind: "product" }> }
    | {
        operation: "restock";
        row: CsvRow;
        product: ExistingProduct;
        quantity: number;
      }
  > = [];
  for (const row of rows) {
    const sku = row.kind === "product" ? row.product.sku : row.sku;
    const product = bySku.get(sku.toLowerCase());
    if (product) {
      const quantity =
        row.kind === "product" ? row.product.stock : row.quantity;
      if (product.archivedAt)
        issues.push({ row: row.row, message: `El SKU ${sku} está archivado.` });
      else if (quantity <= 0)
        issues.push({
          row: row.row,
          message: `Para ${sku}, la cantidad a sumar debe ser mayor que 0.`,
        });
      else if (product.stock + quantity > 99999)
        issues.push({
          row: row.row,
          message: `El stock de ${sku} superaría 99.999 unidades.`,
        });
      else entries.push({ operation: "restock", row, product, quantity });
    } else if (row.kind === "restock") {
      issues.push({
        row: row.row,
        message: `No existe el SKU ${sku}. Completa los datos para crear un producto nuevo.`,
      });
    } else if (bySlug.has(row.product.slug)) {
      issues.push({
        row: row.row,
        message: `Ya existe la URL ${row.product.slug} con otro SKU.`,
      });
    } else entries.push({ operation: "create", row });
  }
  return { entries, issues };
}

export async function importProductsFile(file: File, commit = false) {
  const session = await getSession();
  if (!session || session.role !== "SELLER")
    return {
      ok: false as const,
      issues: [{ row: 0, message: "Debes iniciar sesión como vendedor." }],
    };
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
  if (file.size > MAX_CSV_BYTES)
    return {
      ok: false as const,
      issues: [{ row: 0, message: "El archivo supera 2 MB." }],
    };
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let csv: string;
    let xlsxRows: number[] | undefined;
    let recoveredIdentifiers = 0;
    if (file.name.toLowerCase().endsWith(".csv"))
      csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    else if (file.name.toLowerCase().endsWith(".xlsx")) {
      const { productXlsxToCsv } = await import("@/src/lib/product-xlsx");
      const converted = await productXlsxToCsv(bytes);
      csv = converted.csv;
      xlsxRows = converted.rowNumbers;
      recoveredIdentifiers = converted.recoveredIdentifiers;
    } else throw new Error("Selecciona un archivo .csv o .xlsx.");
    const result = await importProductsCsv(csv, commit);
    if (!xlsxRows) return result;
    const originalRow = (row: number) =>
      row > 1 ? (xlsxRows[row - 2] ?? row) : row;
    if (!result.ok)
      return {
        ...result,
        issues: result.issues.map((issue) => ({
          ...issue,
          row: originalRow(issue.row),
        })),
      };
    if ("preview" in result && result.preview)
      return {
        ...result,
        recoveredIdentifiers,
        preview: result.preview.map((entry) => ({
          ...entry,
          row: originalRow(entry.row),
        })),
      };
    return result;
  } catch (error) {
    return {
      ok: false as const,
      issues: [
        {
          row: 0,
          message:
            error instanceof Error &&
            error.message !==
              "The encoded data was not valid for encoding utf-8"
              ? error.message
              : "El CSV debe estar guardado como UTF-8.",
        },
      ],
    };
  }
}

export async function importProductsCsv(csv: string, commit = false) {
  const session = await getSession();
  if (!session || session.role !== "SELLER")
    return {
      ok: false as const,
      issues: [{ row: 0, message: "Debes iniciar sesión como vendedor." }],
    };
  if (typeof csv !== "string" || typeof commit !== "boolean")
    return {
      ok: false as const,
      issues: [{ row: 0, message: "Solicitud inválida." }],
    };
  try {
    const categories = await db.category.findMany({
      where: { active: true, archivedAt: null },
      select: { id: true, name: true, slug: true },
    });
    const parsed = parseProductCsv(csv, categories);
    if (parsed.issues.length)
      return { ok: false as const, issues: parsed.issues };
    const lookup = {
      OR: [
        {
          sku: {
            in: parsed.rows.map((r) =>
              r.kind === "product" ? r.product.sku : r.sku,
            ),
            mode: "insensitive" as const,
          },
        },
        {
          slug: {
            in: parsed.rows.flatMap((r) =>
              r.kind === "product" ? [r.product.slug] : [],
            ),
          },
        },
      ],
    };
    const existing = await db.product.findMany({
      where: lookup,
      select: existingSelect,
    });
    const plan = planRows(parsed.rows, existing);
    if (plan.issues.length) return { ok: false as const, issues: plan.issues };
    const createdCount = plan.entries.filter(
      (entry) => entry.operation === "create",
    ).length;
    const restockedCount = plan.entries.length - createdCount;
    if (!commit)
      return {
        ok: true as const,
        preview: plan.entries.map((entry) => ({
          row: entry.row.row,
          operation: entry.operation,
          sku:
            entry.operation === "create"
              ? entry.row.product.sku
              : entry.product.sku,
          name:
            entry.operation === "create"
              ? entry.row.product.name
              : entry.product.name,
          category:
            entry.operation === "create"
              ? entry.row.categoryName
              : entry.product.category.name,
          price:
            entry.operation === "create"
              ? entry.row.product.priceCLP
              : entry.product.priceCLP,
          stock:
            entry.operation === "create"
              ? entry.row.product.stock
              : entry.quantity,
          currentStock: entry.operation === "create" ? 0 : entry.product.stock,
          resultingStock:
            entry.operation === "create"
              ? entry.row.product.stock
              : entry.product.stock + entry.quantity,
          active:
            entry.operation === "create"
              ? entry.row.product.active
              : entry.product.active,
        })),
        count: parsed.rows.length,
        createdCount,
        restockedCount,
      };
    await db.$transaction(
      async (tx) => {
        const currentProducts = await tx.product.findMany({
          where: lookup,
          select: existingSelect,
        });
        const current = planRows(parsed.rows, currentProducts);
        if (
          current.issues.length ||
          current.entries.some((entry, index) => {
            const previous = plan.entries[index];
            return (
              !previous ||
              entry.operation !== previous.operation ||
              (entry.operation === "restock" &&
                previous.operation === "restock" &&
                (entry.product.id !== previous.product.id ||
                  entry.product.stock !== previous.product.stock))
            );
          })
        )
          throw new Error("CATALOG_CHANGED");
        const newRows = current.entries.filter(
          (entry) => entry.operation === "create",
        );
        const categoryIds = [
          ...new Set(newRows.map((entry) => entry.row.product.categoryId)),
        ];
        if (categoryIds.length) {
          const available = await tx.category.count({
            where: { id: { in: categoryIds }, active: true, archivedAt: null },
          });
          if (available !== categoryIds.length)
            throw new Error("CATEGORY_CHANGED");
        }
        // The catalogue sorts by createdAt descending. Give earlier file rows
        // slightly newer timestamps so their visible order matches the preview.
        const importTime = Date.now();
        const created = newRows.length
          ? await tx.product.createManyAndReturn({
              data: newRows.map(({ row }) => ({
                ...row.product,
                createdAt: new Date(importTime - (row.row - 2)),
              })),
              select: { id: true, sku: true },
            })
          : [];
        const idsBySku = new Map(
          created.map((product) => [product.sku, product.id]),
        );
        const movements: Prisma.StockMovementCreateManyInput[] = newRows
          .filter(({ row }) => row.product.stock > 0)
          .map(({ row }) => ({
            productId: idsBySku.get(row.product.sku)!,
            type: "IN" as const,
            reason: "INITIAL_LOAD" as const,
            quantity: row.product.stock,
            previousStock: 0,
            resultingStock: row.product.stock,
            actorId: session.sub,
            notes: "Carga masiva de productos",
          }));
        for (const entry of current.entries) {
          if (entry.operation !== "restock") continue;
          await tx.product.update({
            where: { id: entry.product.id },
            data: { stock: { increment: entry.quantity } },
          });
          movements.push({
            productId: entry.product.id,
            type: "IN",
            reason: "RESTOCK",
            quantity: entry.quantity,
            previousStock: entry.product.stock,
            resultingStock: entry.product.stock + entry.quantity,
            actorId: session.sub,
            notes: "Reposición por carga masiva",
          });
        }
        if (movements.length)
          await tx.stockMovement.createMany({ data: movements });
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            actorRole: "SELLER",
            action: "PRODUCT_CSV_IMPORT",
            targetType: "Product",
            metadata: {
              count: parsed.rows.length,
              createdCount,
              restockedCount,
              skus: parsed.rows.map((r) =>
                r.kind === "product" ? r.product.sku : r.sku,
              ),
            },
          },
        });
      },
      { isolationLevel: "Serializable", timeout: 120000, maxWait: 10000 },
    );
    revalidatePath("/trastienda/productos");
    revalidatePath("/trastienda/inventario");
    revalidatePath("/trastienda");
    revalidatePath("/catalogo");
    revalidatePath("/");
    return {
      ok: true as const,
      count: parsed.rows.length,
      createdCount,
      restockedCount,
    };
  } catch (error) {
    const conflict =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(error.code);
    return {
      ok: false as const,
      issues: [
        {
          row: 0,
          message:
            conflict ||
            (error instanceof Error &&
              ["CATALOG_CHANGED", "CATEGORY_CHANGED"].includes(error.message))
              ? "El catálogo cambió durante la carga. Valida el archivo nuevamente. No se guardó ningún producto."
              : "No se pudo importar el archivo. No se guardó ningún producto; revisa la conexión e inténtalo nuevamente.",
        },
      ],
    };
  }
}
