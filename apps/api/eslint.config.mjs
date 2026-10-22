import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'src/generated/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    plugins: { 'import-x': importX },
    rules: {
      // Импортировать можно только пакеты, записанные в apps/api/package.json
      'import-x/no-extraneous-dependencies': ['error', { packageDir: import.meta.dirname }],
      // apps/web и apps/api не знают друг о друге (AGENTS.md)
      'no-restricted-imports': ['error', { patterns: ['**/apps/web/**', 'web', 'web/*'] }],
      // Переменные окружения читает только модуль config
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Use ConfigService (src/config) instead of process.env',
        },
      ],
    },
  },
  {
    // Здесь process.env допустим: валидация env, настройка тестов, конфиги инструментов
    files: [
      'src/config/**',
      'test/**',
      'prisma.config.ts',
      'prisma/**',
      'jest.config.js',
      'eslint.config.mjs',
    ],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    files: ['jest.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
);
