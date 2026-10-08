import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { secureDelete, secureGet, secureSet } from './secure';

// Cliente de la API v1 (src/app/api/v1 del proyecto web).
// - Adjunta el token de acceso (vive solo en memoria, 15 min).
// - Si el servidor responde 401, renueva UNA vez con el refresh token del
//   llavero y reintenta. Varias peticiones a la vez comparten la misma renovación.
// - Los errores llegan como ApiError con un mensaje pensado para el usuario.

const configured: string =
  process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.['apiUrl'] as string | undefined) ?? 'https://hachiko-store.vercel.app';

// En desarrollo, el emulador de Android ve el "localhost" de tu PC como 10.0.2.2
// (el Docker local solo escucha en 127.0.0.1, así que no se expone a la red).
export const API_URL: string =
  __DEV__ && Platform.OS === 'android' ? configured.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, '//10.0.2.2') : configured;

/** Origen del sitio web (para el pago y para enlaces). */
export const SITE_URL = API_URL;

const REFRESH_KEY = 'hachiko.refresh';
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function setSessionLostHandler(fn: () => void) {
  onSessionLost = fn;
}

export async function saveTokens(access: string, refresh: string) {
  accessToken = access;
  await secureSet(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  accessToken = null;
  await secureDelete(REFRESH_KEY);
}

export function hasAccessToken() {
  return accessToken !== null;
}

/** Renueva el par de tokens. Devuelve false si la sesión ya no es válida. */
export async function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refresh = await secureGet(REFRESH_KEY);
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        // 401 = la sesión fue revocada (cerró sesión en otro lado, bloqueo…).
        if (res.status === 401) await clearTokens();
        return false;
      }
      await saveTokens(body.data.accessToken, body.data.refreshToken);
      return true;
    } catch {
      return false; // sin conexión: se mantiene el refresh para intentar después
    }
  })();
  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
}

type Options = { method?: 'GET' | 'POST'; body?: unknown; auth?: boolean; signal?: AbortSignal };

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const send = () =>
    fetch(`${API_URL}/api/v1${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken && opts.auth !== false ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });

  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && opts.auth !== false && (await refreshSession())) res = await send();
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new ApiError(0, 'OFFLINE', 'No hay conexión. Revisa tu internet e inténtalo de nuevo.');
  }

  const body = await res.json().catch(() => null);
  if (res.status === 401 && opts.auth !== false) onSessionLost?.();
  if (!res.ok || !body?.ok) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? 'Algo falló. Inténtalo de nuevo.');
  }
  return body.data as T;
}
