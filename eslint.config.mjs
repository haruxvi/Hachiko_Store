// ESLint 9 usa "flat config". eslint-config-next 16 ya exporta configs planos
// nativos (Linter.Config[]), así que los spreadeamos directamente. Reemplaza a
// lo que antes estaba en .eslintrc.json (next/core-web-vitals + reglas TS), y
// encima aplicamos los overrides propios.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'warn',
      // Reglas nuevas de eslint-plugin-react-hooks v6 (React Compiler) que
      // eslint-config-next 16 activa por defecto. El patrón `mounted`
      // (useEffect → setMounted(true)) es un guard de hidratación intencional
      // para stores de zustand con persist; se dejan en 'warn' para no romper
      // el lint que antes pasaba, sin tocar código que funciona a propósito.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/incompatible-library': 'warn',
    },
  },
];

export default eslintConfig;
