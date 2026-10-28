import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { dark, light, type ColorRoles } from './tokens';

export type ThemePref = 'system' | 'light' | 'dark';

type ThemeValue = { c: ColorRoles; isDark: boolean; pref: ThemePref; setPref: (p: ThemePref) => void };

const ThemeContext = createContext<ThemeValue | null>(null);
const KEY = 'hachiko-theme';

// Sigue el modo claro/oscuro del teléfono, y se puede forzar desde Cuenta.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v);
      })
      .catch(() => undefined);
  }, []);

  const isDark = pref === 'dark' || (pref === 'system' && system === 'dark');
  const c = isDark ? dark : light;

  useEffect(() => {
    // Color del fondo nativo (evita destellos blancos al navegar o con el teclado).
    SystemUI.setBackgroundColorAsync(c.background).catch(() => undefined);
  }, [c.background]);

  const value = useMemo<ThemeValue>(
    () => ({
      c,
      isDark,
      pref,
      setPref: (p) => {
        setPrefState(p);
        AsyncStorage.setItem(KEY, p).catch(() => undefined);
      },
    }),
    [c, isDark, pref],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useTheme fuera de ThemeProvider');
  return v;
}
