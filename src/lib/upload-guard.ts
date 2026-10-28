import { inflateRawSync } from 'node:zlib';

// Revisión de seguridad de los archivos de la carga masiva, ANTES de que una
// librería los abra. Un .xlsx es un ZIP con XML adentro; un "Excel" de un
// chistoso puede ser:
//   - una bomba zip: 2 MB que al descomprimirse ocupan varios GB y botan el servidor;
//   - un Excel con macros (vbaProject.bin, hojas de macros de Excel 4), objetos
//     incrustados (OLE/ActiveX), conexiones externas o vínculos a otros libros;
//   - XML con DOCTYPE/ENTITY (XXE, "billion laughs");
//   - un ejecutable, PDF o HTML renombrado a .xlsx o .csv.
// Todo eso se rechaza aquí. Además, el archivo NUNCA se guarda ni se ejecuta:
// solo se leen los valores de las celdas y se descarta.
//
// Los tamaños se verifican DESCOMPRIMIENDO de verdad con un tope de salida
// (inflateRawSync + maxOutputLength): los tamaños que declara el ZIP se pueden
// falsificar, el tope no.

export class UnsafeUploadError extends Error {
  constructor(
    message: string,
    /** Motivo técnico para la bitácora de auditoría (no se muestra al usuario). */
    readonly reason: string,
  ) {
    super(message);
  }
}

const MAX_ENTRIES = 200;
const MAX_ENTRY_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

// Partes que un Excel de datos normal no necesita y que pueden ejecutar código
// o conectarse a otros sistemas.
const FORBIDDEN_PARTS: [RegExp, string][] = [
  [/vbaProject/i, 'macros VBA'],
  [/(^|\/)macrosheets\//i, 'hoja de macros de Excel 4'],
  [/(^|\/)dialogsheets\//i, 'hoja de diálogo de Excel 4'],
  [/(^|\/)activeX\//i, 'controles ActiveX'],
  [/(^|\/)embeddings\//i, 'objetos incrustados'],
  [/oleObject/i, 'objetos OLE'],
  [/(^|\/)externalLinks\//i, 'vínculos a otros libros'],
  [/(^|\/)connections\.xml$/i, 'conexiones de datos externas'],
  [/(^|\/)customUI\//i, 'personalización de cinta (callbacks de macros)'],
];

// Lo único que se acepta dentro del paquete.
const ALLOWED_EXT = /\.(xml|rels|vml|png|jpe?g|gif|emf|wmf)$/i;
// Excel guarda la configuración de la impresora como .bin: es inofensivo.
const PRINTER_SETTINGS = /^xl\/printerSettings\/printerSettings\d+\.bin$/i;

const sig = (b: Uint8Array, at: number, ...bytes: number[]) => bytes.every((x, i) => b[at + i] === x);
const u16 = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8);
const u32 = (b: Uint8Array, at: number) => (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;

/** Firmas de archivos que jamás deberían llegar como planilla. */
function disguisedAs(b: Uint8Array): string | null {
  if (sig(b, 0, 0x4d, 0x5a)) return 'ejecutable de Windows';
  if (sig(b, 0, 0x7f, 0x45, 0x4c, 0x46)) return 'ejecutable de Linux';
  if (sig(b, 0, 0x25, 0x50, 0x44, 0x46)) return 'PDF';
  if (sig(b, 0, 0xd0, 0xcf, 0x11, 0xe0)) return 'documento de Office antiguo (.xls/.doc)';
  if (sig(b, 0, 0x52, 0x61, 0x72, 0x21)) return 'archivo RAR';
  if (sig(b, 0, 0x37, 0x7a, 0xbc, 0xaf)) return 'archivo 7z';
  return null;
}

/** Revisa un .xlsx completo. Lanza UnsafeUploadError si algo no cuadra. */
export function assertSafeXlsx(b: Uint8Array): void {
  const fake = disguisedAs(b);
  if (fake) throw new UnsafeUploadError('El archivo no es un Excel.', `firma de ${fake}`);
  if (!sig(b, 0, 0x50, 0x4b, 0x03, 0x04))
    throw new UnsafeUploadError('El archivo no es un Excel (.xlsx) válido.', 'sin firma ZIP');

  // Fin del directorio central (EOCD): en los últimos 22 + 65.535 bytes.
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (sig(b, i, 0x50, 0x4b, 0x05, 0x06)) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new UnsafeUploadError('El Excel está dañado.', 'sin EOCD');
  const entries = u16(b, eocd + 10);
  const cdSize = u32(b, eocd + 12);
  const cdOffset = u32(b, eocd + 16);
  if (entries === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff)
    throw new UnsafeUploadError('El Excel es demasiado grande.', 'ZIP64');
  if (entries > MAX_ENTRIES)
    throw new UnsafeUploadError('El Excel contiene demasiadas partes internas.', `${entries} entradas`);
  if (cdOffset + cdSize > eocd) throw new UnsafeUploadError('El Excel está dañado.', 'directorio central fuera de rango');

  const names = new Set<string>();
  let total = 0;
  let p = cdOffset;
  for (let n = 0; n < entries; n++) {
    if (!sig(b, p, 0x50, 0x4b, 0x01, 0x02)) throw new UnsafeUploadError('El Excel está dañado.', 'entrada central inválida');
    const flags = u16(b, p + 8);
    const method = u16(b, p + 10);
    const compSize = u32(b, p + 20);
    const size = u32(b, p + 24);
    const nameLen = u16(b, p + 28);
    const extraLen = u16(b, p + 30);
    const commentLen = u16(b, p + 32);
    const localOffset = u32(b, p + 42);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/')) continue; // carpeta
    if (flags & 0x1) throw new UnsafeUploadError('El Excel está protegido con contraseña o cifrado.', `cifrado: ${name}`);
    if (name.includes('..') || name.startsWith('/') || name.includes('\\') || /[\x00-\x1f]/.test(name))
      throw new UnsafeUploadError('El Excel contiene rutas internas no válidas.', `ruta: ${name}`);
    const forbidden = FORBIDDEN_PARTS.find(([re]) => re.test(name));
    if (forbidden)
      throw new UnsafeUploadError(
        `El Excel contiene ${forbidden[1]}. Por seguridad solo se aceptan planillas con datos: copia los productos a la plantilla de Hachiko.`,
        `parte prohibida: ${name}`,
      );
    if (!ALLOWED_EXT.test(name) && !PRINTER_SETTINGS.test(name) && name !== '[Content_Types].xml')
      throw new UnsafeUploadError('El Excel contiene archivos que no son parte de una planilla.', `extensión: ${name}`);
    if (method !== 0 && method !== 8)
      throw new UnsafeUploadError('El Excel usa una compresión no compatible.', `método ${method}: ${name}`);
    if (size > MAX_ENTRY_BYTES || (total += size) > MAX_TOTAL_BYTES)
      throw new UnsafeUploadError('El Excel contiene demasiados datos.', `tamaño declarado ${size}`);
    names.add(name);

    // Descompresión real con tope: aunque el ZIP mienta sobre su tamaño, no
    // puede producir más de lo permitido.
    if (!sig(b, localOffset, 0x50, 0x4b, 0x03, 0x04)) throw new UnsafeUploadError('El Excel está dañado.', `cabecera local: ${name}`);
    const start = localOffset + 30 + u16(b, localOffset + 26) + u16(b, localOffset + 28);
    const raw = b.subarray(start, start + compSize);
    if (raw.length !== compSize) throw new UnsafeUploadError('El Excel está dañado.', `datos truncados: ${name}`);
    let data: Uint8Array;
    try {
      data = method === 0 ? raw : inflateRawSync(raw, { maxOutputLength: Math.min(size, MAX_ENTRY_BYTES) + 1 });
    } catch {
      throw new UnsafeUploadError('El Excel contiene demasiados datos o está dañado.', `inflado excedido o inválido: ${name}`);
    }
    if (data.length !== size)
      throw new UnsafeUploadError('El Excel está dañado.', `tamaño real ${data.length} ≠ declarado ${size}: ${name}`);

    if (/\.(xml|rels|vml)$/i.test(name)) {
      const xml = new TextDecoder().decode(data);
      if (/<!DOCTYPE|<!ENTITY/i.test(xml))
        throw new UnsafeUploadError('El Excel contiene definiciones XML no permitidas.', `DOCTYPE/ENTITY: ${name}`);
      if (name === '[Content_Types].xml' && /macroEnabled|vbaProject|ms-excel\.(addin|template)/i.test(xml))
        throw new UnsafeUploadError(
          'El archivo es un Excel con macros. Guárdalo como "Libro de Excel (.xlsx)" y vuelve a subirlo.',
          'content type con macros',
        );
      // Vínculos externos a sitios o archivos en las relaciones (p. ej. plantillas remotas).
      if (/\.rels$/i.test(name) && /TargetMode\s*=\s*"External"/i.test(xml) && !/\/hyperlink"/i.test(xml))
        throw new UnsafeUploadError('El Excel apunta a archivos externos.', `relación externa: ${name}`);
    }
  }
  if (!names.has('[Content_Types].xml') || !names.has('xl/workbook.xml'))
    throw new UnsafeUploadError('El archivo no es un Excel (.xlsx) válido.', 'faltan partes de libro');
}

/** Revisa un CSV: debe ser texto, no un binario renombrado. */
export function assertSafeCsv(b: Uint8Array): void {
  const fake = disguisedAs(b);
  if (fake) throw new UnsafeUploadError('El archivo no es un CSV.', `firma de ${fake}`);
  if (sig(b, 0, 0x50, 0x4b, 0x03, 0x04))
    throw new UnsafeUploadError('Este archivo parece un Excel renombrado a .csv. Súbelo como .xlsx.', 'ZIP con extensión .csv');
  if (b.includes(0)) throw new UnsafeUploadError('El archivo no es un CSV de texto.', 'contiene bytes nulos');
}
