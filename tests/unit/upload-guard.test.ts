import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { assertSafeCsv, assertSafeXlsx, UnsafeUploadError } from '@/src/lib/upload-guard';
import { looksLikeFormula } from '@/src/lib/formula-guard';
import { parseProductCsv } from '@/src/lib/product-csv';

// Un "xlsx" mínimo armado a mano, para poder meterle cosas maliciosas.
async function fakeXlsx(extra: Record<string, string | Uint8Array> = {}, contentTypes = '<Types/>') {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('xl/workbook.xml', '<workbook/>');
  for (const [name, data] of Object.entries(extra)) zip.file(name, data);
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
}

const rejects = (fn: () => void, reason: RegExp) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(UnsafeUploadError);
    expect((e as UnsafeUploadError).reason).toMatch(reason);
    return;
  }
  throw new Error('se esperaba que el archivo fuera rechazado');
};

/** Busca la entrada `name` en el directorio central y devuelve su posición. */
function centralEntry(b: Uint8Array, name: string): number {
  const target = new TextEncoder().encode(name);
  for (let i = 0; i < b.length - 46; i++) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x01 && b[i + 3] === 0x02) {
      const len = b[i + 28]! | (b[i + 29]! << 8);
      if (len === target.length && target.every((x, k) => b[i + 46 + k] === x)) return i;
    }
  }
  throw new Error('entrada no encontrada');
}

describe('carga masiva: revisión de seguridad del Excel', () => {
  it('acepta la plantilla oficial de Hachiko', () => {
    const bytes = new Uint8Array(readFileSync(join(process.cwd(), 'public', 'plantilla-productos-hachiko.xlsx')));
    expect(() => assertSafeXlsx(bytes)).not.toThrow();
  });

  it('acepta un Excel normal guardado por una planilla', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('productos').addRow(['nombre', 'descripcion']).commit();
    const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
    expect(() => assertSafeXlsx(bytes)).not.toThrow();
  });

  it('rechaza una bomba zip (pocos KB que se inflan a 30 MB)', async () => {
    const bomb = await fakeXlsx({ 'xl/worksheets/sheet1.xml': 'A'.repeat(30 * 1024 * 1024) });
    expect(bomb.length).toBeLessThan(200 * 1024);
    rejects(() => assertSafeXlsx(bomb), /tamaño declarado/);
  });

  it('rechaza un zip que miente sobre su tamaño (la descompresión real tiene tope)', async () => {
    const bytes = await fakeXlsx({ 'xl/worksheets/sheet1.xml': 'A'.repeat(5 * 1024 * 1024) });
    const at = centralEntry(bytes, 'xl/worksheets/sheet1.xml');
    // Declara 1.000 bytes descomprimidos en vez de 5 MB.
    bytes.set([0xe8, 0x03, 0, 0], at + 24);
    rejects(() => assertSafeXlsx(bytes), /inflado excedido/);
  });

  it.each([
    ['xl/vbaProject.bin', /parte prohibida/],
    ['xl/macrosheets/sheet1.xml', /parte prohibida/],
    ['xl/embeddings/oleObject1.bin', /parte prohibida/],
    ['xl/activeX/activeX1.xml', /parte prohibida/],
    ['xl/externalLinks/externalLink1.xml', /parte prohibida/],
    ['xl/connections.xml', /parte prohibida/],
    ['xl/payload.exe', /extensión/],
    ['xl/script.js', /extensión/],
  ])('rechaza un Excel que trae %s', async (part, reason) => {
    rejects(() => assertSafeXlsx(fakeXlsxSync(part)), reason);
  });

  it('rechaza un .xlsm (Excel con macros) renombrado a .xlsx', async () => {
    const bytes = await fakeXlsx({}, '<Types><Override ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/></Types>');
    rejects(() => assertSafeXlsx(bytes), /macros/);
  });

  it('rechaza XML con DOCTYPE/ENTITY (XXE, billion laughs)', async () => {
    const bytes = await fakeXlsx({
      'xl/worksheets/sheet1.xml': '<!DOCTYPE x [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;">]><worksheet>&b;</worksheet>',
    });
    rejects(() => assertSafeXlsx(bytes), /DOCTYPE/);
  });

  it('rechaza relaciones a archivos externos', async () => {
    const bytes = await fakeXlsx({
      'xl/_rels/workbook.xml.rels':
        '<Relationships><Relationship Type="http://x/attachedTemplate" Target="http://malo.cl/t.dotm" TargetMode="External"/></Relationships>',
    });
    rejects(() => assertSafeXlsx(bytes), /relación externa/);
  });

  it('rechaza rutas internas con ../ (path traversal)', async () => {
    rejects(() => assertSafeXlsx(fakeXlsxSync('../../etc/cron.d/x.xml')), /ruta/);
  });

  it('rechaza un Excel cifrado', async () => {
    const bytes = await fakeXlsx({ 'xl/worksheets/sheet1.xml': '<worksheet/>' });
    const at = centralEntry(bytes, 'xl/worksheets/sheet1.xml');
    bytes[at + 8] = bytes[at + 8]! | 0x1;
    rejects(() => assertSafeXlsx(bytes), /cifrado/);
  });

  it.each([
    ['ejecutable de Windows', [0x4d, 0x5a, 0x90, 0x00]],
    ['PDF', [0x25, 0x50, 0x44, 0x46, 0x2d]],
    ['Office antiguo', [0xd0, 0xcf, 0x11, 0xe0]],
  ])('rechaza un %s renombrado a .xlsx', (_, header) => {
    const bytes = new Uint8Array(64);
    bytes.set(header);
    rejects(() => assertSafeXlsx(bytes), /firma/);
  });
});

describe('carga masiva: CSV', () => {
  it('acepta texto normal', () => {
    expect(() => assertSafeCsv(new TextEncoder().encode('nombre;stock\nRamen;3\n'))).not.toThrow();
  });
  it('rechaza un ejecutable o un zip renombrado a .csv, y binarios', () => {
    rejects(() => assertSafeCsv(new Uint8Array([0x4d, 0x5a, 0, 0])), /firma/);
    rejects(() => assertSafeCsv(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1])), /ZIP/);
    rejects(() => assertSafeCsv(new Uint8Array([0x61, 0x00, 0x62])), /nulos/);
  });
});

describe('inyección de fórmulas', () => {
  it.each(['=HYPERLINK("http://malo.cl","clic")', '+cmd|calc', '@SUM(1)', '\t=1', ' =1', '-2+3', '-SUM(A1)'])(
    'detecta %s',
    (v) => expect(looksLikeFormula(v)).toBe(true),
  );
  it.each(['Ramen Buldak', '- 100 g de fideos', '-10% de descuento', 'Pepero (caja)', '불닭'])('deja pasar %s', (v) =>
    expect(looksLikeFormula(v)).toBe(false),
  );

  it('el importador rechaza un producto con fórmula en el nombre', () => {
    const csv =
      'nombre;descripcion;categoria;precio_clp;stock;peso_gramos\n' +
      '"=HYPERLINK(""http://malo.cl"",""Gratis"")";Rico;snacks;1990;5;100\n';
    const { issues } = parseProductCsv(csv, [{ id: 'c1', name: 'Snacks', slug: 'snacks' }]);
    expect(issues.some((i) => /fórmula/.test(i.message))).toBe(true);
  });

  it('solo acepta rutas locales de imagen, no direcciones del sitio', () => {
    const header = 'nombre;descripcion;categoria;precio_clp;stock;peso_gramos;imagenes\n';
    const row = (img: string) => `Ramen;Rico;snacks;1990;5;100;${img}\n`;
    const cats = [{ id: 'c1', name: 'Snacks', slug: 'snacks' }];
    expect(parseProductCsv(header + row('/productos/ramen.jpg'), cats).issues).toEqual([]);
    expect(parseProductCsv(header + row('/api/auth/logout'), cats).issues.length).toBeGreaterThan(0);
    expect(parseProductCsv(header + row('/../secret.png'), cats).issues.length).toBeGreaterThan(0);
  });
});

// Versión síncrona para it.each: arma el zip con almacenamiento sin compresión.
function fakeXlsxSync(part: string): Uint8Array {
  const files: [string, Uint8Array][] = [
    ['[Content_Types].xml', new TextEncoder().encode('<Types/>')],
    ['xl/workbook.xml', new TextEncoder().encode('<workbook/>')],
    [part, new TextEncoder().encode('<x/>')],
  ];
  const chunks: number[] = [];
  const central: number[] = [];
  const le = (n: number, bytes: number) => Array.from({ length: bytes }, (_, i) => (n >>> (8 * i)) & 0xff);
  for (const [name, data] of files) {
    const nameBytes = [...new TextEncoder().encode(name)];
    const offset = chunks.length;
    const crc = crc32(data);
    chunks.push(...le(0x04034b50, 4), ...le(20, 2), 0, 0, 0, 0, 0, 0, 0, 0, ...le(crc, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nameBytes.length, 2), 0, 0, ...nameBytes, ...data);
    central.push(...le(0x02014b50, 4), ...le(20, 2), ...le(20, 2), 0, 0, 0, 0, 0, 0, 0, 0, ...le(crc, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nameBytes.length, 2), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...le(offset, 4), ...nameBytes);
  }
  const cdOffset = chunks.length;
  return new Uint8Array([...chunks, ...central, ...le(0x06054b50, 4), 0, 0, 0, 0, ...le(files.length, 2), ...le(files.length, 2), ...le(central.length, 4), ...le(cdOffset, 4), 0, 0]);
}

function crc32(data: Uint8Array): number {
  let c = ~0;
  for (const byte of data) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
