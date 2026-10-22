'use client';

import { ActionButton } from '@/features/users/components/action-button';
import { PagedUserList } from '@/features/users/components/paged-user-list';
import {
  useGetBlockedInfiniteQuery,
  useGetMutedInfiniteQuery,
  useGetRestrictedInfiniteQuery,
  useGetStoryHiddenFromInfiniteQuery,
  useShowStoryToMutation,
  useUnblockUserMutation,
  useUnmuteUserMutation,
  useUnrestrictUserMutation,
} from '../api';

// Экраны настроек: заблокированные, ограниченные, скрытые уведомления, «скрыть истории от».

export function BlockedList() {
  const q = useGetBlockedInfiniteQuery();
  const [unblock] = useUnblockUserMutation();
  return (
    <PagedUserList
      items={q.data?.pages.flatMap((p) => p.items) ?? []}
      isLoading={q.isLoading}
      error={q.error}
      refetch={q.refetch}
      hasNextPage={q.hasNextPage}
      isFetchingNextPage={q.isFetchingNextPage}
      fetchNextPage={() => q.fetchNextPage()}
      emptyText="Вы никого не заблокировали"
      renderAction={(user) => (
        <ActionButton label="Разблокировать" onAction={() => unblock(user.id).unwrap()} />
      )}
    />
  );
}

export function RestrictedList() {
  const q = useGetRestrictedInfiniteQuery();
  const [unrestrict] = useUnrestrictUserMutation();
  return (
    <PagedUserList
      items={q.data?.pages.flatMap((p) => p.items) ?? []}
      isLoading={q.isLoading}
      error={q.error}
      refetch={q.refetch}
      hasNextPage={q.hasNextPage}
      isFetchingNextPage={q.isFetchingNextPage}
      fetchNextPage={() => q.fetchNextPage()}
      emptyText="Нет ограниченных аккаунтов"
      renderAction={(user) => (
        <ActionButton label="Снять ограничение" onAction={() => unrestrict(user.id).unwrap()} />
      )}
    />
  );
}

function mutedCaption(user: { posts: boolean; stories: boolean }) {
  if (user.posts && user.stories) return 'Публикации и истории';
  return user.posts ? 'Публикации' : 'Истории';
}

export function MutedList() {
  const q = useGetMutedInfiniteQuery();
  const [unmute] = useUnmuteUserMutation();
  return (
    <PagedUserList
      items={q.data?.pages.flatMap((p) => p.items) ?? []}
      isLoading={q.isLoading}
      error={q.error}
      refetch={q.refetch}
      hasNextPage={q.hasNextPage}
      isFetchingNextPage={q.isFetchingNextPage}
      fetchNextPage={() => q.fetchNextPage()}
      emptyText="Нет скрытых аккаунтов"
      renderSubtitle={mutedCaption}
      renderAction={(user) => (
        <ActionButton label="Показывать" onAction={() => unmute(user.id).unwrap()} />
      )}
    />
  );
}

export function StoryHiddenList() {
  const q = useGetStoryHiddenFromInfiniteQuery();
  const [showStoryTo] = useShowStoryToMutation();
  return (
    <PagedUserList
      items={q.data?.pages.flatMap((p) => p.items) ?? []}
      isLoading={q.isLoading}
      error={q.error}
      refetch={q.refetch}
      hasNextPage={q.hasNextPage}
      isFetchingNextPage={q.isFetchingNextPage}
      fetchNextPage={() => q.fetchNextPage()}
      emptyText="Вы не скрывали истории ни от кого"
      renderAction={(user) => (
        <ActionButton label="Показывать истории" onAction={() => showStoryTo(user.id).unwrap()} />
      )}
    />
  );
}
