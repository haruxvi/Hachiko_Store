import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, shape } from '@/theme/tokens';
import { Txt } from './core';

// Snackbar global: confirma algo que ya pasó, 4 s, sobre la barra inferior.
type Snack = { id: number; message: string; action?: { label: string; onPress: () => void } };
type SnackState = { current: Snack | null; show: (message: string, action?: Snack['action']) => void; hide: () => void };

let seq = 0;
export const useSnack = create<SnackState>((set) => ({
  current: null,
  show: (message, action) => set({ current: { id: ++seq, message, action } }),
  hide: () => set({ current: null }),
}));
export const snack = (message: string, action?: Snack['action']) => useSnack.getState().show(message, action);

export function SnackbarHost({ bottomOffset = 88 }: { bottomOffset?: number }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { current, hide } = useSnack();
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(hide, current.action ? 5000 : 3500);
    return () => clearTimeout(t);
  }, [current, hide]);
  if (!current) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: bottomOffset + insets.bottom, alignItems: 'center' }}>
      <Animated.View
        key={current.id}
        entering={FadeInDown.duration(220)}
        exiting={FadeOutDown.duration(180)}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={{ minHeight: 48, maxWidth: 480, width: '100%', borderRadius: shape.sm, backgroundColor: c.inverseSurface, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, gap: 8, ...elevation(3, c.shadow) }}
      >
        <Txt variant="bodyM" color={c.inverseOnSurface} style={{ flex: 1, paddingVertical: 12 }}>{current.message}</Txt>
        {current.action && (
          <Pressable accessibilityRole="button" onPress={() => { current.action!.onPress(); hide(); }} hitSlop={8} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 }}>
            <Txt variant="labelL" color={c.inversePrimary}>{current.action.label}</Txt>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}
