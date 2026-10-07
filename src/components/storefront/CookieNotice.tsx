'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Aviso INFORMATIVO de cookies (no es un muro de consentimiento). Hachiko solo usa
// cookies estrictamente necesarias (sesión y pago) y guarda el carrito en el
// navegador; no hay publicidad ni seguimiento de terceros, así que no se requiere
// pedir consentimiento. Si algún día se agrega analítica o píxeles publicitarios,
// esto debe pasar a ser un consentimiento real ANTES de cargarlos.
//
// Recordar que se cerró es una preferencia de la propia interfaz (localStorage),
// no un seguimiento.
const STORAGE_KEY = 'hachiko.cookieNotice';
const VERSION = 'v1';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}
function readDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === VERSION;
  } catch {
    return false;
  }
}

export default function CookieNotice() {
  const pathname = usePathname();
  // En el servidor se asume "ya visto": el aviso se pinta solo en el navegador y
  // así no hay diferencias entre el HTML del servidor y el del cliente.
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  const [closed, setClosed] = useState(false);

  if (dismissed || closed || pathname.startsWith('/trastienda') || pathname === '/offline') return null;

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, VERSION);
    } catch {
      // Sin almacenamiento (modo privado estricto): igual se cierra en esta visita.
    }
    setClosed(true);
  }

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed bottom-4 left-4 right-20 z-40 rounded-card border border-sand bg-snow p-4 shadow-soft sm:right-auto sm:max-w-md"
    >
      <p className="text-sm leading-relaxed text-soot">
        Solo usamos cookies esenciales para tu sesión y el pago, y guardamos tu carrito en este navegador.
        Nada de publicidad ni seguimiento.{' '}
        <Link href="/legal/cookies" className="text-taupe underline hover:text-soot">
          Política de cookies
        </Link>
      </p>
      <button type="button" onClick={accept} className="btn-primary btn-sm mt-3">
        Entendido
      </button>
    </div>
  );
}
