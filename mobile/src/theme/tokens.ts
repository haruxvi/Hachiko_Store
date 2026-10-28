// Tokens de la app: traducción 1:1 de mobile/design-system/styles.css.
// Esa guía es la fuente de verdad; si cambias algo aquí, cámbialo allá también.
// Contraste de cada par relleno/texto verificado con la fórmula WCAG (ver la guía).

export type ColorRoles = {
  primary: string; onPrimary: string; primaryStrong: string;
  primaryContainer: string; onPrimaryContainer: string;
  secondary: string; onSecondary: string;
  secondaryContainer: string; onSecondaryContainer: string;
  tertiary: string; onTertiary: string;
  tertiaryContainer: string; onTertiaryContainer: string;
  error: string; onError: string;
  errorContainer: string; onErrorContainer: string;
  infoContainer: string; onInfoContainer: string;
  background: string; surface: string; onSurface: string;
  surfaceVariant: string; onSurfaceVariant: string;
  surfaceContainerLowest: string; surfaceContainerLow: string; surfaceContainer: string;
  surfaceContainerHigh: string; surfaceContainerHighest: string;
  outline: string; outlineVariant: string;
  inverseSurface: string; inverseOnSurface: string; inversePrimary: string;
  scrim: string; shadow: string;
  brandBar: string; onBrandBar: string;
  paper: string; onPaper: string; paperDot: string;
  stampInk: string;
};

export const light: ColorRoles = {
  primary: '#EC9C4A', onPrimary: '#3D2F25', primaryStrong: '#B8692A',
  primaryContainer: '#FBE6BC', onPrimaryContainer: '#94501C',
  secondary: '#FBE7A0', onSecondary: '#3D2F25',
  secondaryContainer: '#FDF1C4', onSecondaryContainer: '#5A4A12',
  tertiary: '#86B596', onTertiary: '#3D2F25',
  tertiaryContainer: '#D8ECDC', onTertiaryContainer: '#3F664D',
  error: '#A94242', onError: '#FFFFFF',
  errorContainer: '#F7E1DD', onErrorContainer: '#8A3434',
  infoContainer: '#D6EEF5', onInfoContainer: '#335F73',
  background: '#FEF7E4', surface: '#FEF7E4', onSurface: '#3D2F25',
  surfaceVariant: '#F0E2C6', onSurfaceVariant: '#76614F',
  surfaceContainerLowest: '#FFFFFF', surfaceContainerLow: '#FFFBF0', surfaceContainer: '#FBF1DC',
  surfaceContainerHigh: '#F7EAD0', surfaceContainerHighest: '#F0E2C6',
  outline: '#9A8370', outlineVariant: '#E9D9B8',
  inverseSurface: '#3D2F25', inverseOnSurface: '#FEF7E4', inversePrimary: '#F7B56E',
  scrim: 'rgba(42,31,24,0.45)', shadow: '#3D2F25',
  brandBar: '#FBE7A0', onBrandBar: '#3D2F25',
  paper: '#FBE7A0', onPaper: '#3D2F25', paperDot: 'rgba(61,47,37,0.09)',
  stampInk: '#B4642A',
};

export const dark: ColorRoles = {
  primary: '#F2A65A', onPrimary: '#2A1B10', primaryStrong: '#F7B56E',
  primaryContainer: '#6B3E17', onPrimaryContainer: '#FFDDBA',
  secondary: '#E9D27C', onSecondary: '#2E2608',
  secondaryContainer: '#4D421A', onSecondaryContainer: '#F8E7A6',
  tertiary: '#9CCBAB', onTertiary: '#0F2E1B',
  tertiaryContainer: '#2D4A37', onTertiaryContainer: '#C9EBD3',
  error: '#FFB4A8', onError: '#5C1A14',
  errorContainer: '#7A2B24', onErrorContainer: '#FFDAD4',
  infoContainer: '#1F4352', onInfoContainer: '#CDEBF5',
  background: '#241B15', surface: '#241B15', onSurface: '#F6EAD7',
  surfaceVariant: '#45372B', onSurfaceVariant: '#C2AD97',
  surfaceContainerLowest: '#1C1410', surfaceContainerLow: '#2A2019', surfaceContainer: '#2F241C',
  surfaceContainerHigh: '#3A2E24', surfaceContainerHighest: '#45372B',
  outline: '#8F7A66', outlineVariant: '#4E3F32',
  inverseSurface: '#F6EAD7', inverseOnSurface: '#3D2F25', inversePrimary: '#94501C',
  scrim: 'rgba(0,0,0,0.55)', shadow: '#000000',
  brandBar: '#2F241C', onBrandBar: '#F6EAD7',
  paper: '#3B321A', onPaper: '#F8E7A6', paperDot: 'rgba(255,240,210,0.07)',
  stampInk: '#F2A65A',
};

export const space = { 0: 0, 2: 2, 4: 4, 8: 8, 12: 12, 16: 16, 20: 20, 24: 24, 32: 32, 40: 40, 48: 48, 64: 64 } as const;
export const shape = { none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 28, full: 999 } as const;

/** Familias cargadas con expo-font en el layout raíz (los nombres deben coincidir). */
export const fonts = {
  display: 'ZenMaruGothic_700Bold',
  displayMedium: 'ZenMaruGothic_500Medium',
  body: 'Quicksand_500Medium',
  bodySemi: 'Quicksand_600SemiBold',
  bodyBold: 'Quicksand_700Bold',
} as const;

/** Escala Material (15 estilos) con la voz de la marca. */
export const type = {
  displayL: { fontFamily: fonts.display, fontSize: 57, lineHeight: 64, letterSpacing: -1.1 },
  displayM: { fontFamily: fonts.display, fontSize: 45, lineHeight: 52, letterSpacing: -0.9 },
  displayS: { fontFamily: fonts.display, fontSize: 36, lineHeight: 44, letterSpacing: -0.5 },
  headlineL: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40, letterSpacing: -0.3 },
  headlineM: { fontFamily: fonts.display, fontSize: 28, lineHeight: 36, letterSpacing: -0.3 },
  headlineS: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32 },
  titleL: { fontFamily: fonts.bodyBold, fontSize: 22, lineHeight: 28 },
  titleM: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 24, letterSpacing: 0.15 },
  titleS: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  bodyL: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, letterSpacing: 0.15 },
  bodyM: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, letterSpacing: 0.2 },
  bodyS: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, letterSpacing: 0.35 },
  labelL: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  labelM: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  labelS: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 16, letterSpacing: 0.5 },
} as const;
export type TypeVariant = keyof typeof type;

/** Elevación 0–5: sombra en iOS/web, `elevation` en Android, teñida de café. */
export function elevation(level: 0 | 1 | 2 | 3 | 4 | 5, shadowColor: string) {
  if (level === 0) return {};
  const y = [0, 1, 2, 4, 6, 8][level]!;
  const r = [0, 3, 8, 16, 24, 36][level]!;
  return {
    shadowColor,
    shadowOffset: { width: 0, height: y },
    shadowOpacity: [0, 0.1, 0.12, 0.14, 0.16, 0.18][level]!,
    shadowRadius: r / 2,
    elevation: [0, 1, 3, 6, 8, 12][level]!,
  };
}

export const motion = {
  short: 150,
  medium: 300,
  long: 500,
} as const;
