// Genera los íconos de la PWA (public/icons/*.png) a partir del logo vectorial
// de src/components/ui/Logo.tsx (huella de pata), sobre el amarillo Shiba.
//
// Uso:  node scripts/generate-pwa-icons.mjs [directorio-de-salida]
//
// `sharp` llega como dependencia de Next, así que se resuelve a través de él y no
// se agrega ninguna dependencia nueva. Si el sistema bloquea binarios nativos
// (p. ej. políticas de control de aplicaciones en Windows), correrlo en Docker:
//   docker compose cp scripts/generate-pwa-icons.mjs app:/app/scripts/
//   docker compose exec app node scripts/generate-pwa-icons.mjs /tmp/icons
//   docker compose cp app:/tmp/icons/. public/icons/
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');

const OUT = resolve(process.argv[2] ?? 'public/icons');
const BUTTER = '#FBE7A0'; // fondo: amarillo Shiba del header
const SOOT = '#3D2F25'; // trazo: marrón del logo

// Mismo dibujo que Logo.tsx (viewBox 32×32).
const PAW = `
  <circle cx="16" cy="16" r="15" stroke="${SOOT}" stroke-width="1.5" fill="none"/>
  <ellipse cx="11" cy="13" rx="2" ry="2.5" fill="${SOOT}"/>
  <ellipse cx="21" cy="13" rx="2" ry="2.5" fill="${SOOT}"/>
  <ellipse cx="13" cy="19" rx="1.6" ry="2" fill="${SOOT}"/>
  <ellipse cx="19" cy="19" rx="1.6" ry="2" fill="${SOOT}"/>
  <ellipse cx="16" cy="22" rx="3" ry="2.4" fill="${SOOT}"/>`;

// `ratio`: fracción del lienzo que ocupa el logo. Los íconos "maskable" van más
// chicos: Android los recorta en círculo/gota y solo garantiza el 80 % central.
function svg(size, ratio) {
  const logo = size * ratio;
  const k = logo / 32;
  const off = (size - logo) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BUTTER}"/>
  <g transform="translate(${off} ${off}) scale(${k})">${PAW}</g>
</svg>`;
}

const ICONS = [
  { file: 'icon-192.png', size: 192, ratio: 0.62 },
  { file: 'icon-512.png', size: 512, ratio: 0.62 },
  { file: 'icon-maskable-512.png', size: 512, ratio: 0.5 },
  { file: 'apple-touch-icon.png', size: 180, ratio: 0.62 }, // iOS redondea las esquinas solo
  { file: 'favicon-32.png', size: 32, ratio: 0.9 },
];

mkdirSync(OUT, { recursive: true });
for (const { file, size, ratio } of ICONS) {
  await sharp(Buffer.from(svg(size, ratio))).png({ compressionLevel: 9 }).toFile(join(OUT, file));
  console.log(`✓ ${file} (${size}×${size})`);
}
