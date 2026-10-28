import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, clearTokens, refreshSession, saveTokens, setSessionLostHandler } from './api';
import type { Me, SessionUser } from './types';

type Status = 'loading' | 'guest' | 'authed';
type LoginResult = { ok: true } | { ok: false; totpRequired?: boolean; message: string };

type SessionState = {
  status: Status;
  user: SessionUser | null;
  /** Modo de la app para un vendedor: la tienda o la trastienda. */
  mode: 'store' | 'seller';
  bootstrap: () => Promise<void>;
  login: (email: string, password: string, totpCode?: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  setMode: (m: 'store' | 'seller') => void;
};

const USER_KEY = 'hachiko.user';
const MODE_KEY = 'hachiko.mode';

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  user: null,
  mode: 'store',

  // Al abrir la app: si hay un refresh en el llavero, se renueva y se carga el perfil.
  async bootstrap() {
    const [cached, mode] = await Promise.all([AsyncStorage.getItem(USER_KEY), AsyncStorage.getItem(MODE_KEY)]);
    if (cached) set({ user: JSON.parse(cached) as SessionUser, status: 'authed' });
    if (mode === 'seller' || mode === 'store') set({ mode });

    const ok = await refreshSession();
    if (!ok) {
      // Sin conexión con sesión guardada: se queda "authed" con el perfil en caché.
      if (!cached) set({ status: 'guest', user: null });
      return;
    }
    try {
      const me = await api<Me>('/me');
      const user: SessionUser = { email: me.email, firstName: me.firstName, role: me.role };
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user, status: 'authed', mode: user.role === 'SELLER' ? get().mode : 'store' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await get().logout();
    }
  },

  async login(email, password, totpCode) {
    try {
      const res = await fetchLogin(email, password, totpCode);
      if ('totpRequired' in res) return { ok: false, totpRequired: true, message: res.message };
      await saveTokens(res.accessToken, res.refreshToken);
      const user = res.user;
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      const mode = user.role === 'SELLER' ? 'seller' : 'store';
      await AsyncStorage.setItem(MODE_KEY, mode);
      set({ user, status: 'authed', mode });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof ApiError ? e.message : 'No pudimos iniciar sesión.' };
    }
  },

  async logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    await Promise.all([clearTokens(), AsyncStorage.multiRemove([USER_KEY, MODE_KEY])]);
    set({ user: null, status: 'guest', mode: 'store' });
  },

  setMode(mode) {
    AsyncStorage.setItem(MODE_KEY, mode).catch(() => undefined);
    set({ mode });
  },
}));

type LoginOk = { accessToken: string; refreshToken: string; user: SessionUser };

// El login responde 200 con ok:false cuando falta el código TOTP.
async function fetchLogin(email: string, password: string, totpCode?: string): Promise<LoginOk | { totpRequired: true; message: string }> {
  try {
    return await api<LoginOk>('/auth/login', { method: 'POST', auth: false, body: { email, password, ...(totpCode ? { totpCode } : {}) } });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'TOTP_REQUIRED') return { totpRequired: true, message: e.message };
    throw e;
  }
}

// Si una renovación falla con 401 en medio del uso, se vuelve a modo invitado.
setSessionLostHandler(() => {
  if (useSession.getState().status === 'authed') void useSession.getState().logout();
});
