import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { dark, light, shape } from '@/theme/tokens';
import { Icon } from './Icon';
import { tap } from './core';

const TRACK_W = 60;
const TRACK_H = 32;
const KNOB = 26;
const TRAVEL = TRACK_W - KNOB - 6;
// La carita usa colores fijos de la marca (café y rosado) en ambos modos.
const INK = light.onSurface;
const BLUSH = '#F9D7CE';

// Interruptor de día/noche: la perilla es una carita que de día está despierta
// (naranja) y de noche duerme (mantequilla). Va arriba a la derecha de cada
// pestaña; la opción "Automático" sigue en Cuenta.
export function ThemeToggle() {
  const { c, isDark, setPref } = useTheme();
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(isDark ? TRAVEL : 0, { damping: 16, stiffness: 220 }) }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Modo noche"
      accessibilityState={{ checked: isDark }}
      onPress={() => { tap(); setPref(isDark ? 'light' : 'dark'); }}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={{
        width: TRACK_W, height: TRACK_H, borderRadius: shape.full, padding: 2, justifyContent: 'center',
        borderWidth: 1, borderColor: c.outline, backgroundColor: isDark ? c.surfaceContainerHighest : c.secondary,
      }}
    >
      <View style={{ position: 'absolute', top: 0, bottom: 0, [isDark ? 'left' : 'right']: 8, justifyContent: 'center' }}>
        <Icon name={isDark ? 'sun' : 'moon'} size={14} color={c.onSurfaceVariant} />
      </View>
      <Animated.View style={[{ width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: isDark ? dark.secondary : light.primary }, knob]}>
        <Face asleep={isDark} />
      </Animated.View>
    </Pressable>
  );
}

function Face({ asleep }: { asleep: boolean }) {
  return (
    <Svg width={KNOB} height={KNOB} viewBox="0 0 26 26">
      <Ellipse cx={6.5} cy={15} rx={2.2} ry={1.3} fill={BLUSH} />
      <Ellipse cx={19.5} cy={15} rx={2.2} ry={1.3} fill={BLUSH} />
      {asleep ? (
        <>
          <Path d="M7.5 11.5 Q9 13.2 10.5 11.5" stroke={INK} strokeWidth={1.4} strokeLinecap="round" fill="none" />
          <Path d="M15.5 11.5 Q17 13.2 18.5 11.5" stroke={INK} strokeWidth={1.4} strokeLinecap="round" fill="none" />
          <Path d="M12 16.5 Q13 17.4 14 16.5" stroke={INK} strokeWidth={1.3} strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <Circle cx={9} cy={12} r={1.6} fill={INK} />
          <Circle cx={17} cy={12} r={1.6} fill={INK} />
          <Path d="M10.5 15.5 Q13 18 15.5 15.5" stroke={INK} strokeWidth={1.4} strokeLinecap="round" fill="none" />
        </>
      )}
    </Svg>
  );
}
