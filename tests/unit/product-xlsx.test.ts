import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { productXlsxToCsv } from "@/src/lib/product-xlsx";
import { parseProductCsv } from "@/src/lib/product-csv";

describe("lectura de Excel para productos", () => {
  it("encuentra encabezados bajo un título y conserva la fila real", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Listado");
    sheet.addRow(["Catálogo de prueba"]);
    sheet.addRow([
      "nombre",
      "descripcion",
      "categoria",
      "precio_clp",
      "stock",
      "peso_gramos",
    ]);
    sheet.addRow(["Snack", "Producto de prueba", "snacks", 1990, 4, 100]);
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
    const converted = await productXlsxToCsv(bytes);
    expect(converted.rowNumbers).toEqual([3]);
    const parsed = parseProductCsv(converted.csv, [
      { id: "clh12345678901234567890123", name: "Snacks", slug: "snacks" },
    ]);
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
  });

  it("reconoce una hoja descriptiva de Hachiko sin pestaña CSV", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Productos");
    sheet.getCell("A2").value = "Catálogo Hachiko";
    sheet.getRow(7).values = [
      "Nombre *",
      "Descripción *",
      "Categoría *",
      "Precio (CLP) *",
      "Stock (un.) *",
      "Peso (g) *",
      "Fotos (URLs)",
      "Nota interna",
    ];
    sheet.getRow(8).values = [
      "Galletas de frutilla",
      "Caja de prueba",
      "snacks",
      2490,
      12,
      120,
      "",
      "No importar",
    ];
    const converted = await productXlsxToCsv(
      new Uint8Array(await workbook.xlsx.writeBuffer()),
    );
    expect(converted.rowNumbers).toEqual([8]);
    const parsed = parseProductCsv(converted.csv, [
      { id: "clh12345678901234567890123", name: "Snacks", slug: "snacks" },
    ]);
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[0]?.product.name).toBe("Galletas de frutilla");
    expect(parsed.rows[0]?.product.priceCLP).toBe(2490);
    expect(converted.csv).not.toContain("No importar");
  });

  it("recupera productos cuando las fórmulas de SKU y URL tienen #REF!", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Productos");
    sheet.getRow(1).values = [
      "Nombre *",
      "Descripción *",
      "Categoría *",
      "Precio (CLP) *",
      "Stock (un.) *",
      "Peso (g) *",
      "Costo (CLP)",
      "Stock mínimo",
      "Nombre coreano",
      "Fotos (URLs)",
      "Activo",
      "Destacado",
      "SKU automático",
      "URL automática",
    ];
    sheet.getRow(2).values = [
      "Galletas Seoul",
      "Caja de prueba",
      "snacks",
      2490,
      12,
      120,
    ];
    sheet.getCell("M2").value = { error: "#REF!" };
    sheet.getCell("N2").value = { error: "#REF!" };
    sheet.getCell("M3").value = { error: "#REF!" };
    sheet.getCell("N3").value = { error: "#REF!" };
    const csvSheet = workbook.addWorksheet("CSV");
    csvSheet.getRow(1).values = [
      "sku",
      "slug",
      "nombre",
      "descripcion",
      "categoria",
      "precio_clp",
      "stock",
      "peso_gramos",
    ];
    csvSheet.getCell("A2").value = { error: "#REF!" };
    const converted = await productXlsxToCsv(
      new Uint8Array(await workbook.xlsx.writeBuffer()),
    );
    const parsed = parseProductCsv(converted.csv, [
      { id: "clh12345678901234567890123", name: "Snacks", slug: "snacks" },
    ]);
    expect(converted.rowNumbers).toEqual([2]);
    expect(converted.recoveredIdentifiers).toBe(1);
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[0]?.product.sku).toMatch(/^AUTO-/);
    expect(parsed.rows[0]?.product.slug).toMatch(/^galletas-seoul-/);
  });

  it("explica qué columnas faltan en un libro sin productos", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook
      .addWorksheet("Inventario")
      .addRow(["Equipo / Usuario", "RAM (GB)"]);
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
    await expect(productXlsxToCsv(bytes)).rejects.toThrow(
      /Faltan: nombre, descripcion, categoria/,
    );
  });
});
