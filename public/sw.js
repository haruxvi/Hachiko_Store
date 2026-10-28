// Service worker de Hachiko (PWA). Diseño conservador por seguridad y privacidad:
//
// - SOLO guarda en el dispositivo recursos públicos e inmutables: los archivos de
//   /_next/static/ (llevan un hash en el nombre, nunca cambian) y /icons/, más la
//   página /offline.
// - NUNCA guarda el HTML de las páginas ni respuestas de /api. El sitio muestra
//   datos personales y de sesión (perfil, pedidos, checkout, trastienda): si se
//   guardaran, otra persona que use el mismo equipo podría verlos sin conexión.
// - Las páginas siempre se piden a la red, así la sesión y el stock están al día.
//   Si no hay conexión, se muestra /offline.
// - No intercepta peticiones que no sean GET ni de otros orígenes (pagos, etc.).
//
// Para forzar que todos los clientes descarten la caché anterior, sube VERSION.
const VERSION = 'v1';
// Dos cachés: SHELL (lo esencial: /offline e íconos) nunca se recorta; ASSETS
// (chunks del sitio) tiene tope, porque cada deploy trae archivos con hashes
// nuevos y sin límite crecería sin fin. Separarlas evita que el recorte borre
// la página /offline, que es lo primero que se guarda y lo más antiguo.
const SHELL = `hachiko-shell-${VERSION}`;
const ASSETS = `hachiko-assets-${VERSION}`;
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];
const MAX_ENTRIES = 150;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  // Borra versiones anteriores de la caché propia (no toca otras cachés del origen).
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('hachiko-') && k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) {
    await cache.delete(key);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Páginas: siempre a la red y sin guardar la respuesta. Sin conexión → /offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Recursos estáticos inmutables: primero la caché, si no está se descarga y guarda.
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              event.waitUntil(
                caches.open(ASSETS).then((cache) => cache.put(request, copy).then(() => trim(cache))),
              );
            }
            return response;
          }),
      ),
    );
  }
  // Todo lo demás (API, datos de React, imágenes externas): el navegador lo maneja
  // normalmente, sin pasar por la caché del service worker.
});
