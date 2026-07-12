import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Configuración ESLint base (flat config) compartida por todo el monorepo.
 * Los paquetes la extienden con reglas específicas de su framework.
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
  {
    ignores: ['dist/**', '.next/**', '.turbo/**', 'node_modules/**', 'generated/**'],
  },
);
