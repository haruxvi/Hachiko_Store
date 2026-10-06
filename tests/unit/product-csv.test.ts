import { describe, expect, it } from "vitest";
import { parseProductCsv, MAX_CSV_BYTES } from "@/src/lib/product-csv";
const cats = [
  { id: "clh12345678901234567890123", name: "Snacks", slug: "snacks" },
];
const header =
  "sku,slug,nombre,descripcion,categoria,precio_clp,stock,peso_gramos";
const row = "SKU-1,snack,Snack,Descripcion,snacks,1990,10,100";
describe("CSV de productos", () => {
  it("genera identificadores estables si faltan las columnas o quedan vacías", () => {
    const minimal =
      "nombre,descripcion,categoria,precio_clp,stock,peso_gramos\nTé de limón,Demo,snacks,1990,10,100";
    const a = parseProductCsv(minimal, cats);
    const b = parseProductCsv(
      "sku,slug," + minimal.replace("\n", "\n,,"),
      cats,
    );
    expect(a.issues).toEqual([]);
    expect(b.issues).toEqual([]);
    expect(a.rows[0]?.product).toEqual(b.rows[0]?.product);
    expect(a.rows[0]?.product.sku).toMatch(/^AUTO-[A-F0-9]{8}$/);
    expect(a.rows[0]?.product.slug).toMatch(/^te-de-limon-[a-f0-9]{8}$/);
    expect(
      parseProductCsv(minimal.replace("1990", "2990"), cats).rows[0]?.product
        .sku,
    ).toBe(a.rows[0]?.product.sku);
  });
  it("mantiene identificadores manuales y rechaza duplicados automáticos", () => {
    expect(
      parseProductCsv(header + "\n" + row, cats).rows[0]?.product.sku,
    ).toBe("SKU-1");
    const automatic = ",,Snack,Descripcion,snacks,1990,10,100";
    expect(
      parseProductCsv(
        header + "\n" + automatic + "\n" + automatic,
        cats,
      ).issues.some((i) => i.message.includes("repetido")),
    ).toBe(true);
  });
  it("acepta plantilla UTF-8 con BOM y punto y coma", () => {
    const r = parseProductCsv(
      "\uFEFFsku;slug;nombre;descripcion;categoria;precio_clp;stock;peso_gramos\r\n" +
        "SKU-1;snack;Snack;Descripcion;snacks;1990;10;100\r\n",
      cats,
    );
    expect(r.issues).toEqual([]);
    expect(r.rows[0]?.product.priceCLP).toBe(1990);
  });
  it("acepta comillas, comas, saltos de línea y comillas escapadas", () => {
    const r = parseProductCsv(
      header +
        '\nSKU-1,snack,"Snack, especial","Una ""caja""\ncoreana",snacks,1990,0,100',
      cats,
    );
    expect(r.issues).toEqual([]);
    expect(r.rows[0]?.product.description).toBe('Una "caja"\ncoreana');
  });
  it.each(["-1", "1.5", "1e3", "2.000", "", "2147483648"])(
    "rechaza número inválido %s",
    (value) => {
      expect(
        parseProductCsv(header + "\n" + row.replace("1990", value), cats).issues
          .length,
      ).toBeGreaterThan(0);
    },
  );
  it("rechaza categoría inexistente", () => {
    expect(
      parseProductCsv(header + "\n" + row.replace("snacks", "otra"), cats)
        .issues.length,
    ).toBeGreaterThan(0);
  });
  it("acepta el nombre visible de una categoría con tildes", () => {
    const categories = [
      {
        id: "clh12345678901234567890123",
        name: "Papelería",
        slug: "papeleria",
      },
    ];
    const r = parseProductCsv(
      header + "\n" + row.replace("snacks", "Papelería"),
      categories,
    );
    expect(r.issues).toEqual([]);
  });
  it("rechaza duplicados internos", () => {
    expect(
      parseProductCsv(header + "\n" + row + "\n" + row, cats).issues.some((i) =>
        i.message.includes("repetido"),
      ),
    ).toBe(true);
  });
  it("rechaza encabezados desconocidos, faltantes y repetidos", () => {
    for (const h of [
      header + ",extra",
      header.replace("nombre,", ""),
      header + ",sku",
    ])
      expect(
        parseProductCsv(h + "\n" + row, cats).issues.length,
      ).toBeGreaterThan(0);
  });
  it("rechaza comillas incompletas y filas desalineadas", () => {
    for (const line of [
      row + ",otro",
      row.replace("Descripcion", '"Descripcion'),
    ])
      expect(
        parseProductCsv(header + "\n" + line, cats).issues.length,
      ).toBeGreaterThan(0);
  });
  it("rechaza archivos vacíos y excesivos", () => {
    for (const csv of [
      "",
      header,
      "x".repeat(MAX_CSV_BYTES + 1),
      header + "\n" + Array(1001).fill(row).join("\n"),
    ])
      expect(parseProductCsv(csv, cats).issues.length).toBeGreaterThan(0);
  });
  it("rechaza imágenes inseguras y booleanos inválidos", () => {
    for (const suffix of [
      "javascript:alert(1),si",
      "https://ejemplo.cl/a.jpg,talvez",
      "//ejemplo.cl/a.jpg,no",
    ])
      expect(
        parseProductCsv(
          header + ",imagenes,activo\n" + row + "," + suffix,
          cats,
        ).issues.length,
      ).toBeGreaterThan(0);
  });
});
