/**
 * Texto que una planilla interpretaría como fórmula si estos datos se abren
 * después en Excel o Google Sheets ("CSV/formula injection"): =, +, @,
 * tabulador o retorno al inicio, y "-" seguido de algo que parece fórmula.
 * Ej.: =HYPERLINK("http://sitio-malo", "clic aquí").
 * Módulo puro (sin dependencias de Node): lo usan el servidor y el navegador.
 */
export function looksLikeFormula(value: string): boolean {
  if (/^[\t\r]/.test(value)) return true;
  const v = value.trimStart();
  if (/^[=+@]/.test(v)) return true;
  return /^-\s*([=+@]|[A-Za-z_.]+\s*\(|\d[\d.,]*\s*[-+*/^])/.test(v);
}
