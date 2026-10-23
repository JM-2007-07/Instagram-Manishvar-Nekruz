'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Schemas } from '@/lib/api/types';

export type FoundAccount = Schemas['FollowListItemDto'];
type AccountsPage = Schemas['SearchUsersPageDto'];

const LIMIT = 20;

/**
 * Единственный запрос через TanStack Query (ADR 0019): поиск аккаунтов GET /api/v1/search/users.
 * Тот же same-origin адрес, что у RTK Query, cookie сессии уходит сама. Хэштеги и места — RTK Query,
 * поэтому аккаунты не запрашиваются дважды.
 * Ошибку отдаём в форме RTK Query ({ status, data }) — её понимают getApiError и ListError.
 */
export async function fetchAccounts(q: string, signal?: AbortSignal): Promise<AccountsPage> {
  const params = new URLSearchParams({ q, limit: String(LIMIT) });
  const res = await fetch(`/api/v1/search/users?${params}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal,
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, data };
  return data as AccountsPage;
}

export const accountSearchKey = (q: string) => ['search', 'users', q] as const;

export function useAccountSearch(q: string) {
  return useQuery({
    queryKey: accountSearchKey(q),
    queryFn: ({ signal }) => fetchAccounts(q, signal), // signal отменяет устаревший запрос при вводе
    enabled: q.length > 0,
    placeholderData: keepPreviousData, // пока идёт новый запрос, видны прошлые результаты
  });
}
