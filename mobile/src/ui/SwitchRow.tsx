import { Pressable, Switch, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt, tap } from './core';

/** Fila con interruptor: toda la fila se puede tocar (área grande, una mano). */
export function SwitchRow({ label, helper, value, onChange }: { label: string; helper?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { c } = useTheme();
  const toggle = () => { tap(); onChange(!value); };
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={helper}
      accessibilityState={{ checked: value }}
      onPress={toggle}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 }}
    >
      <View style={{ flex: 1 }}>
        <Txt variant="bodyL">{label}</Txt>
        {helper && <Txt variant="bodyS" color={c.onSurfaceVariant}>{helper}</Txt>}
      </View>
      <Switch
        value={value}
        onValueChange={toggle}
        trackColor={{ false: c.surfaceContainerHighest, true: c.primary }}
        thumbColor={c.surfaceContainerLowest}
        // En la vista web el interruptor encendido usa su propio verde; se fija el de la marca.
        {...({ activeThumbColor: c.surfaceContainerLowest } as object)}
        ios_backgroundColor={c.surfaceContainerHighest}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}
