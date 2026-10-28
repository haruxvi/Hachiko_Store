import { Pressable } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, shape } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Txt, tap } from './core';

/** Botón flotante extendido (Material 3): la acción principal de la pantalla,
 *  abajo a la derecha, donde llega el pulgar. */
export function ExtendedFab({ icon, label, accessibilityLabel, onPress }: { icon: IconName; label: string; accessibilityLabel?: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => ({ position: 'absolute', right: 16, bottom: 16, height: 56, paddingHorizontal: 20, borderRadius: shape.lg, backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', gap: 12, transform: [{ scale: pressed ? 0.96 : 1 }], ...elevation(3, c.shadow) })}
    >
      <Icon name={icon} size={22} color={c.onPrimary} />
      <Txt variant="labelL" color={c.onPrimary}>{label}</Txt>
    </Pressable>
  );
}
