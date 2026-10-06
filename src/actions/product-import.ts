"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/src/lib/auth/session";
import { db } from "@/src/lib/db";
import {
  MAX_CSV_BYTES,
  parseProductCsv,
  type CsvIssue,
} from "@/src/lib/product-csv";

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
    const existing = await db.product.findMany({
      where: {
        OR: [
          {
            sku: {
              in: parsed.rows.map((r) => r.product.sku),
              mode: "insensitive",
            },
          },
          { slug: { in: parsed.rows.map((r) => r.product.slug) } },
        ],
      },
      select: { sku: true, slug: true },
    });
    const issues: CsvIssue[] = [];
    const existingSkus = new Set(existing.map((p) => p.sku.toLowerCase()));
    const existingSlugs = new Set(existing.map((p) => p.slug));
    for (const row of parsed.rows) {
      if (existingSkus.has(row.product.sku.toLowerCase()))
        issues.push({
          row: row.row,
          message: `Ya existe el SKU ${row.product.sku}.`,
        });
      if (existingSlugs.has(row.product.slug))
        issues.push({
          row: row.row,
          message: `Ya existe el slug ${row.product.slug}.`,
        });
    }
    if (issues.length) return { ok: false as const, issues };
    if (!commit)
      return {
        ok: true as const,
        preview: parsed.rows.map((r) => ({
          row: r.row,
          sku: r.product.sku,
          name: r.product.name,
          category: r.categoryName,
          price: r.product.priceCLP,
          stock: r.product.stock,
          active: r.product.active,
        })),
        count: parsed.rows.length,
      };
    await db.$transaction(
      async (tx) => {
        // Recheck categories within the same serializable transaction as the writes.
        const available = await tx.category.count({
          where: {
            id: {
              in: [...new Set(parsed.rows.map((r) => r.product.categoryId))],
            },
            active: true,
            archivedAt: null,
          },
        });
        if (
          available !==
          new Set(parsed.rows.map((r) => r.product.categoryId)).size
        )
          throw new Error("CATEGORY_CHANGED");
        const conflict = await tx.product.count({
          where: {
            OR: [
              {
                sku: {
                  in: parsed.rows.map((r) => r.product.sku),
                  mode: "insensitive",
                },
              },
              { slug: { in: parsed.rows.map((r) => r.product.slug) } },
            ],
          },
        });
        if (conflict) throw new Error("DUPLICATE");
        // The catalogue sorts by createdAt descending. Give earlier file rows
        // slightly newer timestamps so their visible order matches the preview.
        const importTime = Date.now();
        const created = await tx.product.createManyAndReturn({
          data: parsed.rows.map(({ product }, index) => ({
            ...product,
            createdAt: new Date(importTime - index),
          })),
          select: { id: true, sku: true },
        });
        const idsBySku = new Map(
          created.map((product) => [product.sku, product.id]),
        );
        const movements = parsed.rows
          .filter(({ product }) => product.stock > 0)
          .map(({ product }) => ({
            productId: idsBySku.get(product.sku)!,
            type: "IN" as const,
            reason: "INITIAL_LOAD" as const,
            quantity: product.stock,
            previousStock: 0,
            resultingStock: product.stock,
            actorId: session.sub,
            notes: "Carga masiva de productos",
          }));
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
              skus: parsed.rows.map((r) => r.product.sku),
            },
          },
        });
      },
      { isolationLevel: "Serializable", timeout: 60000, maxWait: 10000 },
    );
    revalidatePath("/trastienda/productos");
    revalidatePath("/trastienda/inventario");
    revalidatePath("/catalogo");
    revalidatePath("/");
    return { ok: true as const, count: parsed.rows.length };
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
              ["DUPLICATE", "CATEGORY_CHANGED"].includes(error.message))
              ? "El catálogo cambió durante la carga. Valida el archivo nuevamente. No se guardó ningún producto."
              : "No se pudo importar el archivo. No se guardó ningún producto; revisa la conexión e inténtalo nuevamente.",
        },
      ],
    };
  }
}
