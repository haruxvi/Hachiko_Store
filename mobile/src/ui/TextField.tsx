import { forwardRef, useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, shape } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Txt } from './core';

// Campo "outlined" de Material con etiqueta flotante. El error dice qué pasó y
// cómo arreglarlo; se anuncia al lector de pantalla.
type Props = TextInputProps & { label: string; error?: string | null; helper?: string; leading?: IconName; secure?: boolean };

export const TextField = forwardRef<TextInput, Props>(function TextField({ label, error, helper, leading, secure, value, onFocus, onBlur, style, ...rest }, ref) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  const [show, setShow] = useState(false);
  const floated = focus || !!value;
  const labelStyle = useAnimatedStyle(() => ({
    top: withTiming(floated ? -9 : 17, { duration: 150 }),
    fontSize: withTiming(floated ? 12 : 16, { duration: 150 }),
  }));
  const border = error ? c.error : focus ? c.primaryStrong : c.outline;
  return (
    <View>
      <View style={{ minHeight: 56, borderWidth: focus || error ? 2 : 1, borderColor: border, borderRadius: shape.xs, flexDirection: 'row', alignItems: 'center', paddingHorizontal: focus || error ? 15 : 16, gap: 12 }}>
        {leading && <Icon name={leading} size={20} color={c.onSurfaceVariant} />}
        <View style={{ flex: 1 }}>
          <Animated.Text
            pointerEvents="none"
            style={[{ position: 'absolute', left: -4, paddingHorizontal: 4, backgroundColor: floated ? c.surface : 'transparent', fontFamily: fonts.bodySemi, color: error ? c.error : focus ? c.onPrimaryContainer : c.onSurfaceVariant }, labelStyle]}
          >
            {label}
          </Animated.Text>
          <TextInput
            ref={ref}
            accessibilityLabel={label}
            accessibilityHint={error ?? helper}
            value={value}
            secureTextEntry={secure && !show}
            placeholderTextColor={c.onSurfaceVariant}
            selectionColor={c.primaryStrong}
            cursorColor={c.primaryStrong}
            onFocus={(e) => { setFocus(true); onFocus?.(e); }}
            onBlur={(e) => { setFocus(false); onBlur?.(e); }}
            style={[{ fontFamily: fonts.body, fontSize: 16, color: c.onSurface, paddingVertical: 16 }, style]}
            {...rest}
          />
        </View>
        {secure && (
          <Pressable accessibilityRole="button" accessibilityLabel={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} onPress={() => setShow((s) => !s)} hitSlop={12}>
            <Icon name={show ? 'eyeOff' : 'eye'} size={22} color={c.onSurfaceVariant} />
          </Pressable>
        )}
      </View>
      {(error || helper) && (
        <Txt variant="bodyS" color={error ? c.error : c.onSurfaceVariant} accessibilityLiveRegion="polite" style={{ marginTop: 4, marginHorizontal: 16 }}>
          {error ?? helper}
        </Txt>
      )}
    </View>
  );
});
