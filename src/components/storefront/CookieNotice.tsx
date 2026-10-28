'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { readConsent, resetConsent, saveConsent, type ConsentChoice } from '@/src/lib/analytics/client';
import Icon from '@/src/components/ui/Icon';

// Aviso de cookies con consentimiento REAL para la medición: las cookies de
// sesión y pago, y el carrito en el navegador, son esenciales y no lo
// requieren; la medición del embudo (vistas, carrito, checkout) es opcional y
// solo se activa si la persona elige "Aceptar medición". Ambas opciones tienen
// el mismo peso visual (sin patrones oscuros). No hay publicidad ni terceros.
//
// La elección se guarda en localStorage (preferencia de la propia interfaz).
// Se puede cambiar después desde la Política de Cookies (CookiePreferencesButton).
//
// En el celular es una tarjeta compacta abajo; desde tablet, una barra a todo el
// ancho. En ambos casos deja libre la esquina del botón flotante de WhatsApp.

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
      className="fixed inset-x-0 bottom-0 z-40 p-3 pr-20 sm:p-4 sm:pr-24 md:p-0"
    >
      <div className="mx-auto max-w-lg rounded-card border border-sand bg-snow/95 p-4 shadow-soft backdrop-blur-md md:max-w-none md:rounded-none md:border-x-0 md:border-b-0 md:border-t">
        <div className="mx-auto flex flex-col gap-3 md:max-w-7xl md:flex-row md:items-center md:justify-between md:gap-6 md:pr-20">
          <div className="flex items-start gap-3 md:items-center">
            <div className="mt-0.5 shrink-0 rounded-full bg-sand/30 p-2 text-soot md:mt-0" aria-hidden="true">
              <Icon name="lock" size={16} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-soot md:hidden">Privacidad y cookies</p>
              <p className="text-xs leading-relaxed text-soot md:text-sm">
                Usamos cookies esenciales para tu sesión y el pago, y guardamos tu carrito en este navegador.
                Si nos dejas, también medimos de forma anónima qué productos se ven y cuántos carritos llegan
                a pagarse, para mejorar la tienda. Nada de publicidad ni terceros.{' '}
                <Link href="/legal/cookies" className="font-medium text-taupe underline hover:text-soot">
                  Política de cookies
                </Link>
              </p>
            </div>
          </div>

          {/* Mismo estilo para las dos opciones: elegir no debe estar inclinado hacia aceptar. */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button type="button" onClick={() => choose('essential')} className="btn-outline btn-sm whitespace-nowrap">
              Solo esenciales
            </button>
            <button type="button" onClick={() => choose('analytics')} className="btn-outline btn-sm whitespace-nowrap">
              Aceptar medición
            </button>
          </div>
        </div>
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
