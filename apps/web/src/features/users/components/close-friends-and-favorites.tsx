'use client';

import {
  useAddCloseFriendMutation,
  useAddFavoriteAccountMutation,
  useGetCloseFriendsInfiniteQuery,
  useGetFavoriteAccountsQuery,
  useRemoveCloseFriendMutation,
  useRemoveFavoriteAccountMutation,
} from '../api';
import { MemberListEditor } from './member-list-editor';

// Настройки → «Близкие друзья»: поиск среди подписок и отметка; участники списка об этом не знают.
export function CloseFriendsEditor() {
  const q = useGetCloseFriendsInfiniteQuery();
  const [add] = useAddCloseFriendMutation();
  const [remove] = useRemoveCloseFriendMutation();
  return (
    <MemberListEditor
      members={q.data?.pages.flatMap((p) => p.items) ?? []}
      isLoading={q.isLoading}
      error={q.error}
      refetch={q.refetch}
      hasNextPage={q.hasNextPage}
      isFetchingNextPage={q.isFetchingNextPage}
      fetchNextPage={() => q.fetchNextPage()}
      emptyText="В списке «Близкие друзья» пока никого нет"
      searchLabel="Поиск среди подписок"
      onAdd={(id) => add(id).unwrap()}
      onRemove={(id) => remove(id).unwrap()}
    />
  );
}

// Настройки → «Избранное» (до 50 аккаунтов, при превышении сервер вернёт LIMIT_REACHED).
export function FavoritesEditor() {
  const q = useGetFavoriteAccountsQuery();
  const [add] = useAddFavoriteAccountMutation();
  const [remove] = useRemoveFavoriteAccountMutation();
  return (
    <MemberListEditor
      members={q.data ?? []}
      isLoading={q.isLoading}
      error={q.error}
      refetch={q.refetch}
      emptyText="В избранном пока никого нет"
      searchLabel="Поиск среди подписок"
      onAdd={(id) => add(id).unwrap()}
      onRemove={(id) => remove(id).unwrap()}
    />
  );
}
