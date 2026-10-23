'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * TanStack Query — только для поиска аккаунтов (требование преподавателя, ADR 0019).
 * Всё остальное по-прежнему RTK Query (baseApi). Один QueryClient на вкладку: создаётся в компоненте,
 * а не в модуле, чтобы на сервере кэш не был общим для разных пользователей.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // повторный ввод того же запроса в течение 30 с — из кэша, без запроса
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
