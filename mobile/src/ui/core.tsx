import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, shape, type as typeScale, type TypeVariant } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';

/** Vibración leve al confirmar algo (agregar al carrito, despachar). No hace nada en web. */
export function tap(kind: 'light' | 'success' | 'warning' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  else void Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
}

// ───────────────────────────── Texto ─────────────────────────────
export function Txt({ variant = 'bodyM', color, style, ...rest }: TextProps & { variant?: TypeVariant; color?: string; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  return <Text maxFontSizeMultiplier={1.6} {...rest} style={[typeScale[variant], { color: color ?? c.onSurface }, style]} />;
}

// Escala al presionar con un pequeño resorte (respuesta táctil, no decoración).
function usePressScale(to = 0.97) {
  const s = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return {
    style,
    onPressIn: () => { s.set(withSpring(to, { damping: 18, stiffness: 400 })); },
    onPressOut: () => { s.set(withSpring(1, { damping: 12, stiffness: 300 })); },
  };
}
const APressable = Animated.createAnimatedComponent(Pressable);

// ───────────────────────────── Botón ─────────────────────────────
type ButtonVariant = 'filled' | 'tonal' | 'elevated' | 'outlined' | 'text';
export function Button({
  label, onPress, variant = 'filled', icon, size = 'md', block, loading, disabled, accessibilityHint, style,
}: {
  label: string; onPress?: () => void; variant?: ButtonVariant; icon?: IconName; size?: 'md' | 'lg';
  block?: boolean; loading?: boolean; disabled?: boolean; accessibilityHint?: string; style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const press = usePressScale();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    filled: { bg: c.primary, fg: c.onPrimary },
    tonal: { bg: c.secondary, fg: c.onSecondary },
    elevated: { bg: c.surfaceContainerLow, fg: c.onPrimaryContainer },
    outlined: { bg: 'transparent', fg: c.onPrimaryContainer, border: c.outline },
    text: { bg: 'transparent', fg: c.onPrimaryContainer },
  };
  const p = palette[variant];
  const off = disabled || loading;
  return (
    <APressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        {
          minHeight: size === 'lg' ? 56 : 48,
          paddingHorizontal: variant === 'text' ? 12 : 24,
          borderRadius: shape.full,
          backgroundColor: disabled ? `${c.onSurface}1F` : p.bg,
          borderWidth: p.border ? 1 : 0,
          borderColor: p.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          alignSelf: block ? 'stretch' : 'flex-start',
          ...(variant === 'elevated' ? elevation(1, c.shadow) : {}),
        },
        press.style,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={18} color={disabled ? `${c.onSurface}61` : p.fg} />}
          <Txt variant={size === 'lg' ? 'titleM' : 'labelL'} color={disabled ? `${c.onSurface}61` : p.fg} numberOfLines={1}>
            {label}
          </Txt>
        </>
      )}
    </APressable>
  );
}

// ───────────────────────────── Botón de ícono ─────────────────────────────
export function IconButton({
  icon, label, onPress, variant = 'standard', selected, badge, color, size = 48, style,
}: {
  icon: IconName; label: string; onPress?: () => void; variant?: 'standard' | 'filled' | 'tonal' | 'outlined' | 'glass';
  selected?: boolean; badge?: number | 'dot'; color?: string; size?: number; style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const press = usePressScale(0.9);
  const bg = { standard: 'transparent', filled: c.primary, tonal: c.secondaryContainer, outlined: 'transparent', glass: `${c.surface}D9` }[variant];
  const fg = color ?? { standard: c.onSurfaceVariant, filled: c.onPrimary, tonal: c.onSecondaryContainer, outlined: c.onSurfaceVariant, glass: c.onSurface }[variant];
  return (
    <APressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={size < 48 ? (48 - size) / 2 : 0}
      style={[
        { width: size, height: size, borderRadius: shape.full, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? c.primaryContainer : bg },
        variant === 'outlined' && { borderWidth: 1, borderColor: c.outline },
        press.style,
        style,
      ]}
    >
      <Icon name={icon} size={size >= 48 ? 24 : 20} color={selected ? c.onPrimaryContainer : fg} filled={selected} />
      {badge !== undefined && <Badge value={badge} />}
    </APressable>
  );
}

export function Badge({ value }: { value: number | 'dot' }) {
  const { c } = useTheme();
  if (value === 0) return null;
  const dot = value === 'dot';
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top: dot ? 10 : 4, right: dot ? 10 : 2, minWidth: dot ? 8 : 16, height: dot ? 8 : 16,
        paddingHorizontal: dot ? 0 : 4, borderRadius: shape.full, backgroundColor: c.error, alignItems: 'center', justifyContent: 'center',
      }}
    >
      {!dot && <Txt variant="labelS" color={c.onError} style={{ lineHeight: 14 }}>{value > 99 ? '99+' : value}</Txt>}
    </View>
  );
}

// ───────────────────────────── Chip ─────────────────────────────
export function Chip({ label, selected, onPress, icon, onRemove }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; onRemove?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        height: 32, paddingHorizontal: 14, borderRadius: shape.sm, flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderColor: selected ? c.secondary : c.outline, backgroundColor: selected ? c.secondary : pressed ? c.surfaceContainerHigh : 'transparent',
      })}
    >
      {(selected || icon) && <Icon name={selected ? 'check' : icon!} size={16} color={selected ? c.onSecondary : c.onPrimaryContainer} />}
      <Txt variant="labelL" color={selected ? c.onSecondary : c.onSurfaceVariant}>{label}</Txt>
      {onRemove && (
        <Pressable accessibilityLabel={`Quitar ${label}`} onPress={onRemove} hitSlop={10}>
          <Icon name="close" size={16} color={c.onSurfaceVariant} />
        </Pressable>
      )}
    </Pressable>
  );
}

// ───────────────────────────── Tarjeta ─────────────────────────────
export function Card({ children, variant = 'elevated', onPress, style, accessibilityLabel }: { children: ReactNode; variant?: 'elevated' | 'filled' | 'outlined'; onPress?: () => void; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const { c } = useTheme();
  const base: ViewStyle = {
    borderRadius: shape.lg,
    padding: 16,
    backgroundColor: { elevated: c.surfaceContainerLow, filled: c.surfaceContainerHighest, outlined: c.surfaceContainerLowest }[variant],
    ...(variant === 'outlined' ? { borderWidth: 1, borderColor: c.outlineVariant } : {}),
    ...(variant === 'elevated' ? elevation(1, c.shadow) : {}),
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}>
      {children}
    </Pressable>
  );
}

// ───────────────────────────── Fila de lista ─────────────────────────────
export function ListItem({
  title, subtitle, leading, trailing, onPress, lines = subtitle ? 2 : 1, accessibilityLabel,
}: { title: string; subtitle?: string; leading?: ReactNode; trailing?: ReactNode; onPress?: () => void; lines?: 1 | 2 | 3; accessibilityLabel?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: [0, 56, 72, 88][lines], paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: lines === 3 ? 'flex-start' : 'center', gap: 16,
        backgroundColor: pressed ? c.surfaceContainerHigh : 'transparent',
      })}
    >
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="titleM" numberOfLines={1}>{title}</Txt>
        {subtitle && <Txt variant="bodyM" color={c.onSurfaceVariant} numberOfLines={lines === 3 ? 2 : 1}>{subtitle}</Txt>}
      </View>
      {trailing}
    </Pressable>
  );
}

export function LeadIcon({ icon, tone = 'secondary' }: { icon: IconName; tone?: 'secondary' | 'primary' | 'tertiary' | 'error' }) {
  const { c } = useTheme();
  const t = {
    secondary: [c.secondaryContainer, c.onSecondaryContainer],
    primary: [c.primaryContainer, c.onPrimaryContainer],
    tertiary: [c.tertiaryContainer, c.onTertiaryContainer],
    error: [c.errorContainer, c.onErrorContainer],
  }[tone];
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t[0], alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={t[1]!} />
    </View>
  );
}

export function Divider({ inset }: { inset?: boolean }) {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.outlineVariant, marginLeft: inset ? 72 : 0 }} />;
}

// ───────────────────────────── Esqueleto de carga ─────────────────────────────
// Pulso suave mientras carga: mejor que un spinner para listas (se ve la forma).
export function Skeleton({ width, height, radius = shape.md, style }: { width: number | `${number}%`; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const o = useSharedValue(0.55);
  useEffect(() => {
    o.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width, height, borderRadius: radius, backgroundColor: c.surfaceContainerHighest }, a, style]} />;
}

// ───────────────────────────── Selector de cantidad ─────────────────────────────
export function Stepper({ value, min = 1, max, onChange, label }: { value: number; min?: number; max: number; onChange: (n: number) => void; label: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: value }} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.outline, borderRadius: shape.full, height: 48 }}>
      <IconButton icon="minus" label="Quitar uno" size={44} onPress={() => { if (value > min) { tap(); onChange(value - 1); } }} color={value <= min ? `${c.onSurface}61` : c.onSurface} />
      <Txt variant="titleM" style={{ minWidth: 24, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{value}</Txt>
      <IconButton icon="plus" label="Agregar uno" size={44} onPress={() => { if (value < max) { tap(); onChange(value + 1); } }} color={value >= max ? `${c.onSurface}61` : c.onSurface} />
    </View>
  );
}
