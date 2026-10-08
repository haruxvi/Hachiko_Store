import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { Button, IconButton, Txt } from './core';

/** Barra superior pequeña: atrás + título + acciones. */
export function TopBar({ title, onBack, actions, tone = 'surface' }: { title?: string; onBack?: (() => void) | false; actions?: ReactNode; tone?: 'surface' | 'brand' }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const bg = tone === 'brand' ? c.brandBar : c.surface;
  const fg = tone === 'brand' ? c.onBrandBar : c.onSurface;
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: bg }}>
      <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: 4 }}>
        {onBack !== false && (
          <IconButton icon="back" label="Volver" color={fg} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} />
        )}
        <Txt variant="titleL" color={fg} numberOfLines={1} accessibilityRole="header" style={{ flex: 1, paddingHorizontal: onBack === false ? 12 : 4 }}>
          {title ?? ''}
        </Txt>
        {actions}
      </View>
    </View>
  );
}

/** Estado vacío o de error: dice qué pasó y qué hacer (con una acción). */
export function EmptyState({ icon, title, body, action, style }: { icon: IconName; title: string; body?: string; action?: { label: string; onPress: () => void }; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48, gap: 12 }, style]}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={32} color={c.onSecondaryContainer} />
      </View>
      <Txt variant="headlineS" style={{ textAlign: 'center' }}>{title}</Txt>
      {body && <Txt variant="bodyL" color={c.onSurfaceVariant} style={{ textAlign: 'center', maxWidth: 320 }}>{body}</Txt>}
      {action && <Button label={action.label} onPress={action.onPress} style={{ alignSelf: 'center', marginTop: 8 }} />}
    </View>
  );
}

/** Encabezado de sección con acción opcional ("Ver todo"). */
export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 28, marginBottom: 12 }}>
      <Txt variant="titleL" accessibilityRole="header">{title}</Txt>
      {action && <Button variant="text" label={action.label} onPress={action.onPress} style={{ minHeight: 40 }} />}
    </View>
  );
}
