import { type Ref } from 'react';
import { Pressable, View, type ViewProps } from 'react-native';
import type { TabTriggerSlotProps } from 'expo-router/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { shape } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Badge, Txt, tap } from './core';

// Barra de navegación inferior (Material 3): pastilla mantequilla en el
// destino activo, ícono con relleno suave, etiqueta siempre visible.
export function NavBar({ children, ref, ...rest }: ViewProps & { ref?: Ref<View> }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      ref={ref}
      accessibilityRole="tablist"
      {...rest}
      style={{ flexDirection: 'row', backgroundColor: c.surfaceContainer, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: c.outlineVariant }}
    >
      {children}
    </View>
  );
}

export function NavItem({ icon, label, badge, isFocused, ref, ...props }: TabTriggerSlotProps & { icon: IconName; label: string; badge?: number; ref?: Ref<View> }) {
  const { c } = useTheme();
  const pill = useAnimatedStyle(() => ({
    transform: [{ scaleX: withSpring(isFocused ? 1 : 0.4, { damping: 16, stiffness: 220 }) }],
    opacity: withSpring(isFocused ? 1 : 0),
  }));
  return (
    <Pressable
      ref={ref}
      {...props}
      onPress={(e) => { if (!isFocused) tap(); props.onPress?.(e); }}
      accessibilityRole="tab"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      accessibilityState={{ selected: !!isFocused }}
      style={{ flex: 1, alignItems: 'center', gap: 4, minHeight: 56 }}
    >
      <View style={{ width: 64, height: 32, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ position: 'absolute', inset: 0, borderRadius: shape.full, backgroundColor: c.secondary, zIndex: 0 }, pill]} />
        <View style={{ zIndex: 1 }}>
          <Icon name={icon} size={24} color={isFocused ? c.onSecondary : c.onSurfaceVariant} filled={isFocused} />
        </View>
        {!!badge && <Badge value={badge} />}
      </View>
      <Txt variant="labelM" color={isFocused ? c.onSurface : c.onSurfaceVariant}>{label}</Txt>
    </Pressable>
  );
}
