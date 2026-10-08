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
        // CTAs primarios — naranja Shiba brillante. Es color de RELLENO: el texto
        // encima va en soot (5.8:1). Para texto naranja se usa `ink` (≥4.5:1 en
        // cream/snow/butter, WCAG AA); rust y rust-dark como texto no se leían (~2:1).
        rust: { DEFAULT: '#EC9C4A', dark: '#DE8C3D', ink: '#94501C' },
        soot: '#3D2F25', // texto principal — marrón cálido, NO negro
        // Texto secundario. Antes era #A8907A (2,8:1 sobre cream: no cumplía WCAG
        // AA, que exige 4,5:1). Ahora 5,5:1 sobre cream, 5,8:1 sobre snow y 4,7:1
        // sobre butter (barra lateral). `deep`, para lo que debe destacar más.
        taupe: { DEFAULT: '#76614F', deep: '#5E4B3C' },
        blush: '#F9D7CE', // decorativo — un solo uso por vista
        petal: '#F0A48F', // SOLO ilustración (lengua / orejas internas)
        mint: { DEFAULT: '#D8ECDC', deep: '#86B596', ink: '#3F664D' }, // deep = relleno; ink = texto (5,3:1)
        sky: { DEFAULT: '#D6EEF5', deep: '#7DA8C7', ink: '#335F73' },
        alert: '#A94242', // antes #C75E5E (3,8:1); ahora 5,5:1 sobre cream
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
