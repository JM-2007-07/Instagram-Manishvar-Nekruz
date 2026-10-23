import path from 'node:path';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const bannedPackages = [
  { name: 'axios', message: 'Запросы из браузера — только RTK Query (AGENTS.md §5, ADR 0010).' },
  { name: 'swr', message: 'SWR запрещён: используйте RTK Query (AGENTS.md §5, ADR 0010).' },
  {
    name: 'openapi-fetch',
    message: 'openapi-fetch запрещён: используйте RTK Query (AGENTS.md §5, ADR 0010).',
  },
  {
    name: 'zustand',
    message: 'Zustand запрещён: состояние UI — useState, данные — RTK Query (AGENTS.md §5).',
  },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'coverage/**', 'next-env.d.ts', 'src/lib/api/schema.d.ts']),
  {
    rules: {
      // Только пакеты из apps/web/package.json (или корневого, для npm workspaces — ADR 0008)
      'import/no-extraneous-dependencies': [
        'error',
        {
          packageDir: [import.meta.dirname, path.resolve(import.meta.dirname, '../..')],
          devDependencies: [
            '**/*.test.{ts,tsx}',
            'vitest.config.mts',
            'vitest.setup.ts',
            'src/lib/test-utils.tsx',
            'eslint.config.mjs',
            'postcss.config.mjs',
          ],
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: bannedPackages,
          patterns: [
            {
              group: ['@tanstack/*'],
              message:
                'TanStack Query — только в поиске аккаунтов (features/search/user-search.ts, ADR 0019); иначе RTK Query (ADR 0010).',
            },
            {
              group: ['**/apps/api', '**/apps/api/**'],
              message:
                'apps/web не импортирует из apps/api (AGENTS.md §5, ADR 0008). Типы — из lib/api/types.ts.',
            },
            {
              // выход за пределы src/ к соседнему пакету api (не ловит '@/lib/api/...')
              group: ['../../../api/**', '../../../../api/**', '../../../../../api/**'],
              message: 'apps/web не импортирует из apps/api (AGENTS.md §5, ADR 0008).',
            },
          ],
        },
      ],
    },
  },
  {
    // ADR 0019: TanStack Query разрешён только здесь — поиск аккаунтов и один QueryClient.
    files: [
      'src/features/search/user-search.ts',
      'src/lib/query-client.tsx',
      'src/features/search/components/search-content.test.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: bannedPackages, patterns: [{ group: ['**/apps/api', '**/apps/api/**'] }] },
      ],
    },
  },
]);
