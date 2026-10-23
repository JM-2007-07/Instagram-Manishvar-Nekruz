'use client';

import { useState } from 'react';
import { useGetMeQuery } from '@/features/profile/api';
import type { UserSummary } from '@/lib/api/types';
import { useGetFollowingInfiniteQuery } from '../api';
import { useDebouncedValue } from '../use-debounced-value';
import { ActionButton } from './action-button';
import { PagedUserList } from './paged-user-list';
import { SearchField } from './search-field';

// Редактор личного списка (близкие друзья, избранное): без поиска — текущие участники с «Убрать»;
// при вводе — поиск среди своих подписок с «Добавить» / «Убрать».
export function MemberListEditor({
  members,
  isLoading,
  error,
  refetch,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage = () => {},
  emptyText,
  searchLabel,
  onAdd,
  onRemove,
}: {
  members: UserSummary[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
  emptyText: string;
  searchLabel: string;
  onAdd: (userId: string) => Promise<unknown>;
  onRemove: (userId: string) => Promise<unknown>;
}) {
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim(), 300);
  const me = useGetMeQuery();
  const searching = q.length > 0;
  const following = useGetFollowingInfiniteQuery(
    { userId: me.data?.id ?? '', q },
    { skip: !searching || !me.data },
  );
  const memberIds = new Set(members.map((m) => m.id));

  return (
    <div className="flex flex-col gap-2">
      <SearchField value={text} onChange={setText} label={searchLabel} />
      {searching ? (
        <PagedUserList
          items={following.data?.pages.flatMap((p) => p.items) ?? []}
          isLoading={following.isLoading}
          error={following.error}
          refetch={following.refetch}
          hasNextPage={following.hasNextPage}
          isFetchingNextPage={following.isFetchingNextPage}
          fetchNextPage={() => following.fetchNextPage()}
          emptyText="Ничего не найдено"
          renderAction={(user) =>
            memberIds.has(user.id) ? (
              <ActionButton label="Убрать" onAction={() => onRemove(user.id)} />
            ) : (
              <ActionButton label="Добавить" variant="default" onAction={() => onAdd(user.id)} />
            )
          }
        />
      ) : (
        <PagedUserList
          items={members}
          isLoading={isLoading}
          error={error}
          refetch={refetch}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          emptyText={emptyText}
          renderAction={(user) => (
            <ActionButton label="Убрать" onAction={() => onRemove(user.id)} />
          )}
        />
      )}
    </div>
  );
}
