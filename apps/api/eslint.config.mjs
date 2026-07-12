import base from '@nab/config/eslint/base';

export default [
  ...base,
  {
    // NestJS usa los imports de valor para la inyección de dependencias (reflect-metadata),
    // así que no forzamos `import type` en la API.
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
  { ignores: ['dist/**', 'vitest.config.*'] },
];
