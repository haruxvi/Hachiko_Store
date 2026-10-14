// Medición del embudo de la tienda (vistas → carrito → checkout), SOLO con
// consentimiento. Diseño de privacidad (Ley 21.719):
//  - Opt-in: si la persona elige "solo esenciales" (o no responde) no se envía nada.
//  - Sin cookies ni identificadores persistentes: el id de sesión vive en
//    sessionStorage y desaparece al cerrar la pestaña.
//  - Sin terceros: los eventos van a /api/analytics del propio sitio.
//  - La cuenta solo se asocia en el servidor si la persona aceptó además el uso
//    comercial de sus datos (consentMarketing); si no, el evento es anónimo.

export type ClientEventType =
  | 'PAGE_VIEW'
  | 'PRODUCT_VIEW'
  | 'SEARCH'
  | 'ADD_TO_CART'
  | 'REMOVE_FROM_CART'
  | 'CHECKOUT_START';

export interface ClientEvent {
  type: ClientEventType;
  productId?: string;
  query?: string;
  results?: number;
  path?: string;
}

// Misma clave que el aviso de cookies: la elección de la persona se guarda una vez.
export const CONSENT_KEY = 'hachiko.cookieNotice';
export const CONSENT_VERSION = 'v2';
export type ConsentChoice = 'analytics' | 'essential';

const SESSION_KEY = 'hachiko.analyticsSession';

export function readConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw === `${CONSENT_VERSION}:analytics`) return 'analytics';
    if (raw === `${CONSENT_VERSION}:essential`) return 'essential';
    return null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: ConsentChoice) {
  try {
    localStorage.setItem(CONSENT_KEY, `${CONSENT_VERSION}:${choice}`);
  } catch {
    // Sin almacenamiento (modo privado estricto): sin consentimiento guardado no se mide.
  }
  if (choice === 'essential') {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // nada que borrar
    }
  }
}

/** Olvida la elección (y la sesión de medición) para volver a preguntar. */
export function resetConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // sin almacenamiento: no había nada guardado
  }
}

/** Id de sesión de medición, o null si no hay consentimiento. */
export function analyticsSessionId(): string | null {
  if (typeof window === 'undefined' || readConsent() !== 'analytics') return null;
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function track(event: ClientEvent) {
  const sessionId = analyticsSessionId();
  if (!sessionId) return;
  const body = JSON.stringify({ ...event, sessionId, path: event.path ?? location.pathname });
  try {
    // sendBeacon sobrevive a la navegación (p. ej. "agregar" y saltar al carrito)
    if (navigator.sendBeacon?.('/api/analytics', new Blob([body], { type: 'application/json' }))) return;
  } catch {
    // sigue con fetch
  }
  void fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'same-origin',
  }).catch(() => undefined);
}
