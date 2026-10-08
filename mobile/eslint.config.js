// ESLint de la app (independiente del proyecto web de la raíz).
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'design-system/*', '.expo/*'] },
]);
