// Regla única para URLs de imágenes de producto (formulario manual y servidor;
// la carga masiva aplica la misma). Solo https y sin credenciales en la URL:
//  - descarta esquemas como javascript: o data:, que no son imágenes de catálogo;
//  - evita imágenes http://, que el navegador bloquea en un sitio https y que
//    exponen la IP de quien mira la página a un servidor sin cifrar.
// Devuelve la URL normalizada, o null si no es aceptable.
export function safeImageUrl(raw: string): string | null {
  let href: string;
  try {
    const url = new URL(raw.trim());
    if (url.username || url.password) return null;
    href = url.href;
  } catch {
    return null;
  }
  return href.startsWith('https://') ? href : null;
}
