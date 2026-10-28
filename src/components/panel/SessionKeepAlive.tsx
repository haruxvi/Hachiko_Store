'use client';

import { useEffect } from 'react';

// El access token dura 15 min y el middleware NO lo renueva solo: sin esto, a los
// 15 min de tener el panel abierto la siguiente navegación caía en /login aunque
// la sesión siguiera válida (el refresh token dura 7 días). Aquí lo renovamos en
// silencio contra /api/auth/refresh —que valida en BD: tokenVersion, bloqueo y
// borrado, así que NO debilita la revocación— bastante antes de que expire, y
// también al volver a la pestaña (p. ej. tras suspender el equipo).
const REFRESH_EVERY_MS = 12 * 60 * 1000; // 12 min < 15 min de vida del access token

export default function SessionKeepAlive() {
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      // credentials same-origin para que viaje la cookie httpOnly; los errores se
      // ignoran: si el refresh falla, la próxima navegación ya redirige a /login.
      fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    };

    const id = setInterval(refresh, REFRESH_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
