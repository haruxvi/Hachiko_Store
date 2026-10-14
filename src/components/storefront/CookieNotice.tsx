'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { readConsent, resetConsent, saveConsent, type ConsentChoice } from '@/src/lib/analytics/client';

// Aviso de cookies con consentimiento REAL para la medición: las cookies de
// sesión y pago, y el carrito en el navegador, son esenciales y no lo
// requieren; la medición del embudo (vistas, carrito, checkout) es opcional y
// solo se activa si la persona elige "Aceptar medición". Ambas opciones tienen
// el mismo peso visual (sin patrones oscuros). No hay publicidad ni terceros.
//
// La elección se guarda en localStorage (preferencia de la propia interfaz).
// Se puede cambiar después desde la Política de Cookies (CookiePreferencesButton).

const CHANGE_EVENT = 'hachiko:cookie-consent';
const REOPEN_EVENT = 'hachiko:cookie-preferences';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export default function CookieNotice() {
  const pathname = usePathname();
  // En el servidor se asume "ya respondió": el aviso se pinta solo en el
  // navegador y así no hay diferencias entre el HTML del servidor y el del cliente.
  const answered = useSyncExternalStore(subscribe, () => readConsent() !== null, () => true);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    const reopen = () => setClosed(false);
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_EVENT, reopen);
  }, []);

  if (answered || closed || pathname.startsWith('/trastienda') || pathname === '/offline') return null;

  function choose(choice: ConsentChoice) {
    saveConsent(choice);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    setClosed(true);
  }

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed bottom-4 left-4 right-20 z-40 rounded-card border border-sand bg-snow p-4 shadow-soft sm:right-auto sm:max-w-md"
    >
      <p className="text-sm leading-relaxed text-soot">
        Usamos cookies esenciales para tu sesión y el pago, y guardamos tu carrito en este navegador.
        Si nos dejas, también medimos de forma anónima qué productos se ven y cuántos carritos llegan
        a pagarse, para mejorar la tienda. Nada de publicidad ni terceros.{' '}
        <Link href="/legal/cookies" className="text-taupe underline hover:text-soot">
          Política de cookies
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => choose('analytics')} className="btn-primary btn-sm">
          Aceptar medición
        </button>
        <button type="button" onClick={() => choose('essential')} className="btn-primary btn-sm">
          Solo esenciales
        </button>
      </div>
    </div>
  );
}

/** Vuelve a mostrar el aviso para cambiar la elección (Política de Cookies). */
export function CookiePreferencesButton() {
  return (
    <button
      type="button"
      className="btn-outline btn-sm"
      onClick={() => {
        resetConsent();
        window.dispatchEvent(new Event(REOPEN_EVENT));
        window.dispatchEvent(new Event(CHANGE_EVENT));
      }}
    >
      Cambiar mis preferencias de cookies
    </button>
  );
}
