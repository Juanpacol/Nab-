// @ts-check
const expoConfig = require('eslint-config-expo/flat');

/** Configuración ESLint (flat) de la app móvil, sobre el preset de Expo. */
module.exports = [
  ...expoConfig,
  {
    ignores: ['.expo/**', 'dist/**', 'android/**', 'ios/**'],
  },
];
