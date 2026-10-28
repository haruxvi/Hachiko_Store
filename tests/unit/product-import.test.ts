import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  categories: vi.fn(),
  existing: vi.fn(),
  txExisting: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  createManyAndReturn: vi.fn(),
  movementMany: vi.fn(),
  audit: vi.fn(),
  categoryCount: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/src/lib/auth/session", () => ({ getSession: mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/src/lib/db", () => ({
  db: {
    category: { findMany: mocks.categories },
    product: { findMany: mocks.existing },
    $transaction: mocks.transaction,
  },
}));
import {
  importProductsCsv,
  importProductsFile,
} from "@/src/actions/product-import";
const csv =
  "sku;slug;nombre;descripcion;categoria;precio_clp;stock;peso_gramos;" +
  "costo_clp;stock_minimo;nombre_coreano;imagenes;activo;destacado\r\n" +
  "TEST-001;test-producto-uno;Producto uno;Descripción de prueba;snacks;" +
  "1990;20;100;1000;5;;;si;no\r\n";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ sub: "seller", role: "SELLER" });
  mocks.categories.mockResolvedValue([
    { id: "clh12345678901234567890123", slug: "snacks", name: "Snacks" },
  ]);
  mocks.existing.mockResolvedValue([]);
  mocks.txExisting.mockResolvedValue([]);
  mocks.categoryCount.mockResolvedValue(1);
  mocks.createManyAndReturn.mockImplementation(async ({ data }) =>
    data.map((product: { sku: string }, index: number) => ({
      id: `new-product-${index}`,
      sku: product.sku,
    })),
  );
  mocks.transaction.mockImplementation(async (fn) =>
    fn({
      category: { count: mocks.categoryCount },
      product: {
        findMany: mocks.txExisting,
        createManyAndReturn: mocks.createManyAndReturn,
        update: mocks.update,
      },
      stockMovement: { createMany: mocks.movementMany },
      auditLog: { create: mocks.audit },
    }),
  );
});
describe("Carga masiva autorizada", () => {
  it.each([null, { role: "CLIENT" }])(
    "rechaza sesión sin permisos",
    async (session) => {
      mocks.session.mockResolvedValue(session);
      expect((await importProductsCsv(csv, true)).ok).toBe(false);
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );
  it("reconoce la plantilla Excel vacía sin guardar productos", async () => {
    const categories = [
      "snacks",
      "skincare",
      "papeleria",
      "kpop",
      "bebestibles",
      "sopas",
    ].map((slug) => ({ id: "clh12345678901234567890123", slug, name: slug }));
    mocks.categories.mockResolvedValue(categories);
    const bytes = readFileSync(
      resolve("public/plantilla-productos-hachiko.xlsx"),
    );
    const file = new File([bytes], "plantilla-productos-hachiko.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const result = await importProductsFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(
        result.issues.some((issue) =>
          issue.message.includes("no contiene productos"),
        ),
      ).toBe(true);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("valida 1.000 filas generadas en memoria sin escribir", async () => {
    const header = csv.split("\r\n")[0]!;
    const rows = Array.from({ length: 1000 }, (_, index) =>
      csv
        .split("\r\n")[1]!
        .replace("TEST-001", `TEST-${index + 1}`)
        .replace("test-producto-uno", `test-producto-${index + 1}`)
        .replace("Producto uno", `Producto ${index + 1}`),
    );
    const result = await importProductsCsv(
      [header, ...rows].join("\r\n") + "\r\n",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.count).toBe(1000);
      expect(result.preview?.[0]?.sku).toBe("TEST-1");
      expect(result.preview?.[999]?.sku).toBe("TEST-1000");
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("confirma 1.000 filas generadas en memoria en una sola transacción", async () => {
    const header = csv.split("\r\n")[0]!;
    const rows = Array.from({ length: 1000 }, (_, index) =>
      csv
        .split("\r\n")[1]!
        .replace("TEST-001", `TEST-${index + 1}`)
        .replace("test-producto-uno", `test-producto-${index + 1}`)
        .replace("Producto uno", `Producto ${index + 1}`),
    );
    const result = await importProductsCsv(
      [header, ...rows].join("\r\n") + "\r\n",
      true,
    );
    expect(result).toEqual({
      ok: true,
      count: 1000,
      createdCount: 1000,
      restockedCount: 0,
    });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.createManyAndReturn).toHaveBeenCalledOnce();
    expect(mocks.createManyAndReturn.mock.calls[0]![0].data).toHaveLength(1000);
    expect(mocks.movementMany).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it("valida un CSV subido como archivo", async () => {
    const file = new File([csv], "productos.csv", { type: "text/csv" });
    const result = await importProductsFile(file);
    expect(result.ok).toBe(true);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rechaza un XLSX corrupto", async () => {
    const file = new File(["no es excel"], "falso.xlsx");
    const result = await importProductsFile(file);
    expect(result.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("vista previa no escribe", async () => {
    const r = await importProductsCsv(csv);
    expect(r.ok).toBe(true);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("suma stock de un SKU existente sin cambiar sus datos", async () => {
    mocks.categories.mockResolvedValue([]);
    const product = {
      id: "existing-1",
      sku: "TEST-001",
      slug: "otro",
      name: "Nombre en tienda",
      stock: 7,
      priceCLP: 2990,
      active: true,
      archivedAt: null,
      category: { name: "Snacks" },
    };
    mocks.existing.mockResolvedValue([product]);
    mocks.txExisting.mockResolvedValue([product]);
    const preview = await importProductsCsv("sku,stock\nTEST-001,20\n");
    expect(preview.ok).toBe(true);
    if (preview.ok)
      expect(preview.preview?.[0]).toMatchObject({
        operation: "restock",
        name: "Nombre en tienda",
        stock: 20,
        currentStock: 7,
        resultingStock: 27,
      });
    mocks.categories.mockResolvedValue([
      { id: "clh12345678901234567890123", slug: "snacks", name: "Snacks" },
    ]);
    const fullRowPreview = await importProductsCsv(csv);
    expect(fullRowPreview.ok).toBe(true);
    if (fullRowPreview.ok)
      expect(fullRowPreview.preview?.[0]).toMatchObject({
        operation: "restock",
        name: "Nombre en tienda",
        price: 2990,
      });
    expect(await importProductsCsv("sku,stock\nTEST-001,20\n", true)).toEqual({
      ok: true,
      count: 1,
      createdCount: 0,
      restockedCount: 1,
    });
    expect(mocks.createManyAndReturn).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "existing-1" },
      data: { stock: { increment: 20 } },
    });
    expect(mocks.movementMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          productId: "existing-1",
          reason: "RESTOCK",
          quantity: 20,
          previousStock: 7,
          resultingStock: 27,
        }),
      ],
    });
  });
  it("mezcla un producto nuevo y una reposición en el mismo archivo", async () => {
    const existing = {
      id: "existing-1",
      sku: "EXIST-1",
      slug: "producto-existente",
      name: "Producto existente",
      stock: 5,
      priceCLP: 4500,
      active: true,
      archivedAt: null,
      category: { name: "Snacks" },
    };
    mocks.existing.mockResolvedValue([existing]);
    mocks.txExisting.mockResolvedValue([existing]);
    const restock = [
      "EXIST-1",
      "",
      "",
      "",
      "",
      "",
      "3",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ].join(";");
    const mixed = csv + restock + "\r\n";
    expect(await importProductsCsv(mixed, true)).toEqual({
      ok: true,
      count: 2,
      createdCount: 1,
      restockedCount: 1,
    });
    expect(mocks.createManyAndReturn.mock.calls[0]![0].data).toHaveLength(1);
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(
      mocks.movementMany.mock.calls[0]![0].data.map(
        (movement: { reason: string }) => movement.reason,
      ),
    ).toEqual(["INITIAL_LOAD", "RESTOCK"]);
  });
  it("rechaza reposición de un SKU desconocido y cantidad cero", async () => {
    expect((await importProductsCsv("sku,stock\nDESCONOCIDO,2\n")).ok).toBe(
      false,
    );
    expect((await importProductsCsv("sku,stock\nTEST-001,0\n")).ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("no guarda si cualquier fila es inválida", async () => {
    expect((await importProductsCsv(csv.replace("1990", "-2"), true)).ok).toBe(
      false,
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("crea producto, stock inicial y auditoría dentro de una transacción", async () => {
    expect(await importProductsCsv(csv, true)).toEqual({
      ok: true,
      count: 1,
      createdCount: 1,
      restockedCount: 0,
    });
    expect(mocks.createManyAndReturn).toHaveBeenCalledOnce();
    expect(mocks.movementMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          productId: "new-product-0",
          quantity: 20,
          reason: "INITIAL_LOAD",
          actorId: "seller",
        }),
      ],
    });
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it("conserva el orden del archivo en listados recientes", async () => {
    const lines = csv.trimEnd().split("\r\n");
    const second = lines[1]!
      .replace("TEST-001", "TEST-002")
      .replace("test-producto-uno", "test-producto-dos")
      .replace("Producto uno", "Producto dos");
    const twoProducts = [lines[0], lines[1], second].join("\r\n") + "\r\n";
    expect((await importProductsCsv(twoProducts, true)).ok).toBe(true);
    const inserted = mocks.createManyAndReturn.mock.calls[0]![0].data as Array<{
      sku: string;
      createdAt: Date;
    }>;
    expect(inserted.map((p) => p.sku)).toEqual(["TEST-001", "TEST-002"]);
    expect(inserted[0]!.createdAt.getTime()).toBeGreaterThan(
      inserted[1]!.createdAt.getTime(),
    );
  });
  it("revalida si un SKU cambió entre la vista previa y la confirmación", async () => {
    mocks.txExisting.mockResolvedValue([
      {
        id: "other",
        sku: "TEST-001",
        slug: "test-producto-uno",
        name: "Otro",
        stock: 1,
        priceCLP: 1990,
        active: true,
        archivedAt: null,
        category: { name: "Snacks" },
      },
    ]);
    expect((await importProductsCsv(csv, true)).ok).toBe(false);
    expect(mocks.createManyAndReturn).not.toHaveBeenCalled();
  });
  it("revalida categoría al confirmar", async () => {
    mocks.categoryCount.mockResolvedValue(0);
    expect((await importProductsCsv(csv, true)).ok).toBe(false);
    expect(mocks.createManyAndReturn).not.toHaveBeenCalled();
  });
  it("informa fallo de transacción sin anunciar éxito", async () => {
    mocks.transaction.mockRejectedValue(new Error("database error"));
    expect((await importProductsCsv(csv, true)).ok).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
