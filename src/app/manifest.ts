import type { MetadataRoute } from 'next';

// Manifiesto de la PWA (servido en /manifest.webmanifest). Es lo que permite
// "Instalar app" en Chrome/Edge/Android y "Agregar a inicio" en iPhone. Los
// íconos se generan con scripts/generate-pwa-icons.mjs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Hachiko · Productos Coreanos',
    short_name: 'Hachiko',
    description:
      'Snacks, skincare, papelería y merch K-pop con despacho a todo Chile y retiro en tienda (Recoleta).',
    lang: 'es-CL',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FEF7E4', // cream: fondo de la pantalla de carga
    theme_color: '#FBE7A0', // butter: color del header, tiñe la barra del sistema
    categories: ['shopping', 'food', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Accesos directos al mantener presionado el ícono (Android) o clic derecho (escritorio).
    shortcuts: [
      { name: 'Catálogo', url: '/catalogo', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Mi carrito', url: '/carrito', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Mis pedidos', url: '/pedidos', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
  };
}
