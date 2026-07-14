import type { Config } from 'tailwindcss';

// Paleta "Shiba pastel" — gama del Shiba real (tan + blanco + rosa lengua +
// outline marrón) en versión pastel. Estricta: no agregar colores.
const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/actions/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        butter: '#FBE7A0', // header / footer / sidebar — amarillo Shiba, todas las páginas
        cream: '#FEF7E4', // fondo principal — crema claro, contrasta con el butter
        snow: '#FFFFFF', // superficies elevadas
        sand: '#F0E2C6', // bordes sutiles, separadores
        tan: { DEFAULT: '#F3BE8B', mid: '#ED9F5C', soft: '#FBE6BC' },
        rust: { DEFAULT: '#EC9C4A', dark: '#DE8C3D' }, // CTAs primarios — naranja Shiba brillante
        soot: '#3D2F25', // texto principal — marrón cálido, NO negro
        taupe: '#A8907A', // texto secundario
        blush: '#F9D7CE', // decorativo — un solo uso por vista
        petal: '#F0A48F', // SOLO ilustración (lengua / orejas internas)
        mint: { DEFAULT: '#D8ECDC', deep: '#86B596' },
        sky: { DEFAULT: '#D6EEF5', deep: '#7DA8C7' },
        alert: '#C75E5E',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Hiragino Maru Gothic ProN', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        editorial: ['var(--font-editorial)', 'Iowan Old Style', 'Georgia', 'serif'],
        hangul: [
          'var(--font-display)',
          'Apple SD Gothic Neo',
          'Noto Sans KR',
          'sans-serif',
        ],
      },
      borderRadius: {
        input: '4px',
        chip: '8px',
        btn: '12px',
        card: '20px',
      },
      boxShadow: {
        soft: '0 2px 8px rgba(61, 47, 37, 0.06)',
        lift: '0 8px 24px rgba(61, 47, 37, 0.10)',
      },
    },
  },
  plugins: [],
};

export default config;
