'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track, type ClientEvent } from '@/src/lib/analytics/client';

/** Una vista de página por cada navegación (layout de la tienda y del checkout). */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    track({ type: 'PAGE_VIEW', path: pathname });
  }, [pathname]);
  return null;
}

/**
 * Registra un evento al montarse (vista de producto, búsqueda, inicio de
 * checkout). `eventKey` evita duplicados si el componente se re-renderiza.
 */
export function TrackOnMount({ event, eventKey }: { event: ClientEvent; eventKey: string }) {
  useEffect(() => {
    track(event);
    // eventKey resume el contenido del evento; event cambia de identidad en cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey]);
  return null;
}
