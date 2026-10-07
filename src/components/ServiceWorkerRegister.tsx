'use client';

import { useEffect } from 'react';

// Registra el service worker de la PWA (public/sw.js). Solo en producción: en
// desarrollo guardaría chunks que cambian con cada edición y confundiría el
// hot reload. `updateViaCache: 'none'` hace que el navegador siempre consulte
// la red por una versión nueva de sw.js, así los arreglos llegan de inmediato.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Sin service worker el sitio funciona igual; solo no habrá página offline.
    });
  }, []);

  return null;
}
