'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { readConsent, resetConsent, saveConsent, type ConsentChoice } from '@/src/lib/analytics/client';

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
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 md:p-0"
    >
      <div className="mx-auto max-w-lg rounded-card border border-sand bg-snow/95 p-4 shadow-soft backdrop-blur-md md:max-w-none md:rounded-none md:border-x-0 md:border-b-0 md:border-t md:p-4">
        <div className="mx-auto flex flex-col gap-3 md:max-w-7xl md:flex-row md:items-center md:justify-between md:gap-6">
          
          {/* Texto / Contenido */}
          <div className="flex items-start gap-3 md:items-center">
            <div className="mt-0.5 shrink-0 rounded-full bg-sand/30 p-2 text-soot md:mt-0">
              <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-soot md:hidden">
                Privacidad y cookies
              </h3>
              <p className="text-xs leading-relaxed text-taupe md:text-sm">
                Usamos cookies esenciales para tu sesión y el pago. Con tu consentimiento, también medimos de forma anónima el uso del sitio para mejorar tu experiencia.{' '}
                <Link href="/legal/cookies" className="font-medium text-soot underline transition-colors hover:text-taupe">
                  Más información
                </Link>
              </p>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex shrink-0 items-center gap-2 pt-1 md:pt-0">
            <button
              type="button"
              onClick={() => choose('essential')}
              className="btn-outline btn-sm text-xs whitespace-nowrap"
            >
              Solo esenciales
            </button>
            <button
              type="button"
              onClick={() => choose('analytics')}
              className="btn-primary btn-sm text-xs whitespace-nowrap"
            >
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