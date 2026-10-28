import { useEffect, useId, type ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect, Text as SvgText, TextPath, Ellipse } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

// Elementos de la marca (extensiones del sistema de diseño).

/** Cartulina mantequilla punteada: saludo, carnet y destacados. */
export function Paper({ children, style, radius = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; radius?: number }) {
  const { c } = useTheme();
  const id = useId().replace(/:/g, '');
  return (
    <View style={[{ backgroundColor: c.paper, borderRadius: radius, overflow: 'hidden' }, style]}>
      <Svg style={{ position: 'absolute', inset: 0 } as never} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <Pattern id={`dots${id}`} width={14} height={14} patternUnits="userSpaceOnUse">
            <Circle cx={1} cy={1} r={1} fill={c.paperDot} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#dots${id})`} />
      </Svg>
      {children}
    </View>
  );
}

/** Foto de producto o, mientras no haya, cartón punteado con el nombre en coreano. */
export function ProductArt({ korean, tone = 0, style, size = 28 }: { korean: string | null; tone?: number; style?: StyleProp<ViewStyle>; size?: number }) {
  const { c } = useTheme();
  const tones = [
    [c.secondaryContainer, c.primaryContainer],
    [c.tertiaryContainer, c.secondaryContainer],
    [c.infoContainer, c.secondaryContainer],
    [c.primaryContainer, c.surfaceContainerHighest],
  ][tone % 4]!;
  const id = useId().replace(/:/g, '');
  return (
    <View style={[{ backgroundColor: tones[0], overflow: 'hidden' }, style]}>
      <Svg style={{ position: 'absolute', inset: 0 } as never} width="100%" height="100%">
        <Defs>
          <Pattern id={`p${id}`} width={12} height={12} patternUnits="userSpaceOnUse">
            <Circle cx={1} cy={1} r={1} fill={c.paperDot} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={tones[1]} opacity={0.55} />
        <Rect width="100%" height="100%" fill={`url(#p${id})`} />
      </Svg>
      {korean ? (
        // Nombres largos en dos líneas y más chicos, en vez de cortarse con "…".
        <Text
          numberOfLines={2}
          style={{ position: 'absolute', left: 12, right: 12, bottom: 8, fontFamily: fonts.display, fontSize: korean.length > 5 ? size * 0.72 : size, lineHeight: (korean.length > 5 ? size * 0.72 : size) * 1.15, color: c.onSurface, opacity: 0.16 }}
        >
          {korean}
        </Text>
      ) : null}
    </View>
  );
}

/** Tono estable por producto (para que cada uno tenga su color de cartón). */
export const toneFor = (slug: string) => [...slug].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 4;

/** Timbre: único momento expresivo en pedido confirmado y cuenta verificada. */
export function Stamp({ text = 'PAGO RECIBIDO ✶ HACHIKO ✶', size = 112, animate = true }: { text?: string; size?: number; animate?: boolean }) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const s = useSharedValue(animate && !reduce ? 1.6 : 1);
  const o = useSharedValue(animate && !reduce ? 0 : 1);
  useEffect(() => {
    if (!animate || reduce) return;
    s.set(withDelay(300, withSpring(1, { damping: 9, stiffness: 180 })));
    o.set(withDelay(300, withSpring(1)));
  }, [animate, reduce, s, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ rotate: '-11deg' }, { scale: s.value }] }));
  const id = useId().replace(/:/g, '');
  return (
    <Animated.View style={[{ width: size, height: size }, a]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs>
          <Path id={`arc${id}`} d="M60,60 m-41,0 a41,41 0 1,1 82,0 a41,41 0 1,1 -82,0" />
        </Defs>
        <G stroke={c.stampInk} fill="none" opacity={0.92}>
          <Circle cx={60} cy={60} r={56} strokeWidth={3} />
          <Circle cx={60} cy={60} r={31} strokeWidth={1.6} />
        </G>
        <SvgText fill={c.stampInk} fontSize={10.5} fontWeight="700" letterSpacing={2.4}>
          <TextPath href={`#arc${id}`}>{text}</TextPath>
        </SvgText>
        <G fill={c.stampInk} transform="translate(40 40) scale(1.66)">
          <Ellipse cx={7} cy={9} rx={1.8} ry={2.3} />
          <Ellipse cx={17} cy={9} rx={1.8} ry={2.3} />
          <Ellipse cx={9.6} cy={5.2} rx={1.6} ry={2} />
          <Ellipse cx={14.4} cy={5.2} rx={1.6} ry={2} />
          <Path d="M12 11.5c-3 0-5.5 3.2-5.5 5.6 0 1.8 1.6 2.4 3 2.1 1-.2 1.6-.6 2.5-.6s1.5.4 2.5.6c1.4.3 3-.3 3-2.1 0-2.4-2.5-5.6-5.5-5.6z" />
        </G>
      </Svg>
    </Animated.View>
  );
}
