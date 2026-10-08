import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import type { ReactElement } from 'react';

// Mismo sprite que mobile/design-system/icons.html: contorno estilo Material,
// trazo 2, puntas redondeadas. Toma el color que se le pase (nunca emoji).
const P = (d: string) => <Path d={d} />;

const ICONS = {
  home: P('M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'),
  search: <><Circle cx="11" cy="11" r="7" />{P('m20 20-3.5-3.5')}</>,
  bag: <>{P('M5 8h14l-1 12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z')}{P('M9 8V6a3 3 0 0 1 6 0v2')}</>,
  heart: P('M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z'),
  user: <><Circle cx="12" cy="8" r="4" />{P('M4 21a8 8 0 0 1 16 0')}</>,
  store: <>{P('M4 9.5 5.5 4h13L20 9.5')}{P('M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0')}{P('M5 12v8h14v-8')}{P('M10 20v-4h4v4')}</>,
  package: <>{P('M21 8 12 3 3 8v8l9 5 9-5z')}{P('m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5')}</>,
  truck: <>{P('M2 6h12v10H2zM14 10h4l3 3v3h-7')}<Circle cx="6" cy="18" r="2" /><Circle cx="17" cy="18" r="2" /></>,
  tag: <>{P('M3 12V4h8l10 10-8 8z')}<Circle cx="7.5" cy="8" r="1.5" /></>,
  receipt: <>{P('M6 3h12v18l-3-2-3 2-3-2-3 2z')}{P('M9 8h6M9 12h6')}</>,
  list: <>{P('M9 6h11M9 12h11M9 18h11')}<Circle cx="4.5" cy="6" r="1" /><Circle cx="4.5" cy="12" r="1" /><Circle cx="4.5" cy="18" r="1" /></>,
  chart: P('M4 20V10M10 20V4M16 20v-7M22 20H2'),
  menu: P('M4 7h16M4 12h16M4 17h16'),
  back: <>{P('M20 12H5')}{P('m11 5-7 7 7 7')}</>,
  chevronLeft: P('m15 6-6 6 6 6'),
  chevronRight: P('m9 6 6 6-6 6'),
  chevronDown: P('m6 9 6 6 6-6'),
  close: P('M18 6 6 18M6 6l12 12'),
  check: P('m5 12 5 5L20 7'),
  plus: P('M12 5v14M5 12h14'),
  minus: P('M5 12h14'),
  sliders: <>{P('M4 7h10M18 7h2M4 17h4M12 17h8')}<Circle cx="16" cy="7" r="2" /><Circle cx="10" cy="17" r="2" /></>,
  bell: <>{P('M18 9a6 6 0 0 0-12 0c0 6-2.5 8-2.5 8h17S18 15 18 9')}{P('M13.7 20a2 2 0 0 1-3.4 0')}</>,
  lock: <><Rect x="4" y="11" width="16" height="10" rx="2" />{P('M8 11V7a4 4 0 0 1 8 0v4')}</>,
  mail: <><Rect x="3" y="5" width="18" height="14" rx="2" />{P('m3 7 9 6 9-6')}</>,
  eye: <>{P('M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z')}<Circle cx="12" cy="12" r="3" /></>,
  eyeOff: <>{P('M3 3l18 18')}{P('M10.6 6.1A10 10 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3 3.6M6.6 6.7C3.8 8.5 2 12 2 12s3.6 7 10 7a9.5 9.5 0 0 0 4.7-1.3')}{P('M9.9 10a3 3 0 0 0 4.2 4.2')}</>,
  edit: <>{P('M4 20h4L19 9l-4-4L4 16z')}{P('m13.5 6.5 4 4')}</>,
  trash: <>{P('M4 7h16M10 11v6M14 11v6')}{P('M6 7l1 13h10l1-13M9 7V4h6v3')}</>,
  share: <>{P('M12 3v12M7 8l5-5 5 5')}{P('M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6')}</>,
  clock: <><Circle cx="12" cy="12" r="9" />{P('M12 7v5l3 2')}</>,
  pin: <>{P('M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z')}<Circle cx="12" cy="9.5" r="2.5" /></>,
  scan: P('M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 8v8M10 8v8M13 8v8M17 8v8'),
  alert: <>{P('M12 3 2 20h20z')}{P('M12 10v4M12 17h.01')}</>,
  info: <><Circle cx="12" cy="12" r="9" />{P('M12 11v5M12 8h.01')}</>,
  refresh: P('M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4'),
  logout: P('M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4'),
  moon: P('M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'),
  sun: <><Circle cx="12" cy="12" r="4" />{P('M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4')}</>,
  phone: P('M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2'),
  external: <>{P('M14 4h6v6M20 4l-9 9')}{P('M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5')}</>,
  paw: <><Ellipse cx="7" cy="9" rx="1.8" ry="2.3" /><Ellipse cx="17" cy="9" rx="1.8" ry="2.3" /><Ellipse cx="9.6" cy="5.2" rx="1.6" ry="2" /><Ellipse cx="14.4" cy="5.2" rx="1.6" ry="2" />{P('M12 11.5c-3 0-5.5 3.2-5.5 5.6 0 1.8 1.6 2.4 3 2.1 1-.2 1.6-.6 2.5-.6s1.5.4 2.5.6c1.4.3 3-.3 3-2.1 0-2.4-2.5-5.6-5.5-5.6z')}</>,
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24, color, filled = false, strokeWidth = 2 }: { name: IconName; size?: number; color: string; filled?: boolean; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} fillOpacity={filled ? 0.18 : 1} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </Svg>
  );
}
