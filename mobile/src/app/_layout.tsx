import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useFonts, ZenMaruGothic_500Medium, ZenMaruGothic_700Bold } from '@expo-google-fonts/zen-maru-gothic';
import { Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { useSession } from '@/lib/session';
import { ApiError } from '@/lib/api';
import { SnackbarHost } from '@/ui/Snackbar';

void SplashScreen.preventAutoHideAsync();

// Caché de datos pensada para el celular: reintenta ante cortes de red (no
// ante errores del servidor que no se arreglan reintentando) y vuelve a
// consultar al volver a la app.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (n, e) => n < 2 && (!(e instanceof ApiError) || e.status === 0 || e.status >= 500),
      retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
    },
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ ZenMaruGothic_500Medium, ZenMaruGothic_700Bold, Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold });
  const bootstrap = useSession((s) => s.bootstrap);
  const status = useSession((s) => s.status);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    void bootstrap();
    // Sin conexión, no se deja al usuario mirando el splash: a los 2,5 s se sigue.
    const t = setTimeout(() => setTimedOut(true), 2500);
    return () => clearTimeout(t);
  }, [bootstrap]);

  const ready = fontsLoaded && (status !== 'loading' || timedOut);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <Navigation />
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Navigation() {
  const { c, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background }, animation: 'slide_from_right' }}>
        <Stack.Screen name="login" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="pedido-confirmado" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
      <SnackbarHost />
    </>
  );
}
