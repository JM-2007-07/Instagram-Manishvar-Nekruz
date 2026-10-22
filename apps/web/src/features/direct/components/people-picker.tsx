'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { getApiError } from '@/lib/api/errors';
import type { UserSummary } from '@/lib/api/types';
import { useSearchPeopleQuery } from '../api';
import { ChatAvatar } from './chat-avatar';

// Поиск людей с выбором (чекбоксы): для нового чата и добавления участников.
export function PeoplePicker({
  selected,
  onToggle,
  excludeIds = [],
}: {
  selected: UserSummary[];
  onToggle: (user: UserSummary) => void;
  excludeIds?: string[];
}) {
  const [query, setQuery] = useState('');
  const q = query.trim();
  const { data, isFetching, isError, error } = useSearchPeopleQuery(q, { skip: q.length === 0 });
  const users = (data?.items ?? []).filter((u) => !excludeIds.includes(u.id));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <label className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <span className="sr-only">Поиск людей</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск…"
          className="min-w-0 flex-1 bg-transparent text-14 outline-none"
        />
      </label>

      {selected.length > 0 && (
        <ul aria-label="Выбранные" className="flex flex-wrap gap-2 px-4 py-2">
          {selected.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => onToggle(user)}
                aria-label={`Убрать ${user.userName}`}
                className="rounded-full bg-muted px-3 py-1 text-12 font-semibold text-primary"
              >
                {user.userName} ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isError && (
          <p role="alert" className="p-4 text-14 text-muted-foreground">
            {getApiError(error).code === 'NETWORK_ERROR'
              ? 'Нет соединения с сервером'
              : 'Не удалось выполнить поиск'}
          </p>
        )}
        {!isError && q && !isFetching && users.length === 0 && (
          <p className="p-4 text-14 text-muted-foreground">Аккаунты не найдены</p>
        )}
        <ul>
          {users.map((user) => {
            const checked = selected.some((s) => s.id === user.id);
            return (
              <li key={user.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-hover-overlay">
                  <ChatAvatar url={user.avatarUrl} name={user.userName} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-14 font-semibold">{user.userName}</span>
                    <span className="block truncate text-12 text-muted-foreground">
                      {user.fullName}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(user)}
                    aria-label={`Выбрать ${user.userName}`}
                    className="size-5"
                  />
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
