'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useGetMeQuery, useGetProfileByUserNameQuery } from '@/features/profile/api';
import { showApiError } from '@/lib/api/errors';
import type { FollowListItem } from '@/lib/api/types';
import {
  useGetFollowersInfiniteQuery,
  useGetFollowingInfiniteQuery,
  useRemoveFollowerMutation,
} from '../api';
import { useDebouncedValue } from '../use-debounced-value';
import { FollowButton } from './follow-button';
import { EmptyMessage, ListError, LoadMore, UserListSkeleton } from './list-states';
import { ModalShell } from './modal-shell';
import { SearchField } from './search-field';
import { UserListItem } from './user-list-item';

export type FollowListKind = 'followers' | 'following';

const TITLES: Record<FollowListKind, string> = { followers: 'Подписчики', following: 'Подписки' };
const EMPTY: Record<FollowListKind, string> = {
  followers: 'Нет подписчиков',
  following: 'Вы ещё ни на кого не подписаны',
};

function RemoveFollowerButton({ userId }: { userId: string }) {
  const [removeFollower, { isLoading }] = useRemoveFollowerMutation();
  async function handleClick() {
    try {
      await removeFollower(userId).unwrap();
    } catch (error) {
      showApiError(error);
    }
  }
  return (
    <Button variant="secondary" disabled={isLoading} onClick={handleClick}>
      Удалить
    </Button>
  );
}

function FollowListBody({
  userId,
  kind,
  isOwner,
  myId,
}: {
  userId: string;
  kind: FollowListKind;
  isOwner: boolean;
  myId?: string;
}) {
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim(), 300);
  const arg = { userId, q };
  const followers = useGetFollowersInfiniteQuery(arg, { skip: kind !== 'followers' });
  const following = useGetFollowingInfiniteQuery(arg, { skip: kind !== 'following' });
  const query = kind === 'followers' ? followers : following;
  const items: FollowListItem[] = query.data?.pages.flatMap((page) => page.items) ?? [];

  function action(item: FollowListItem) {
    if (item.id === myId) return null;
    // У своих подписчиков вместо подписки — «Удалить» (F-SOC-04).
    if (isOwner && kind === 'followers') return <RemoveFollowerButton userId={item.id} />;
    return (
      <FollowButton userId={item.id} followStatus={item.followStatus} isPrivate={item.isPrivate} />
    );
  }

  let content: React.ReactNode;
  if (query.isLoading) content = <UserListSkeleton />;
  else if (query.isError)
    content = (
      <ListError error={query.error} notFoundText="Профиль недоступен" onRetry={query.refetch} />
    );
  else if (items.length === 0)
    content = <EmptyMessage>{q ? 'Ничего не найдено' : EMPTY[kind]}</EmptyMessage>;
  else
    content = (
      <>
        {items.map((item) => (
          <UserListItem key={item.id} user={item} action={action(item)} />
        ))}
        <LoadMore
          hasNextPage={query.hasNextPage}
          isFetching={query.isFetchingNextPage}
          onLoad={() => query.fetchNextPage()}
        />
      </>
    );

  return (
    <>
      <div className="shrink-0 px-4 py-2">
        <SearchField value={text} onChange={setText} label={`Поиск в разделе «${TITLES[kind]}»`} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">{content}</div>
    </>
  );
}

// Окно «Подписчики» / «Подписки» поверх профиля. intercepted = открыто перехватом маршрута (закрытие — назад);
// при прямой ссылке закрытие ведёт на профиль.
export function FollowListDialog({
  userName,
  kind,
  intercepted = false,
}: {
  userName: string;
  kind: FollowListKind;
  intercepted?: boolean;
}) {
  const router = useRouter();
  const profile = useGetProfileByUserNameQuery(userName);
  const me = useGetMeQuery();

  function close() {
    if (intercepted) router.back();
    else router.push(`/${userName}/`);
  }

  let body: React.ReactNode;
  if (profile.isLoading) body = <UserListSkeleton />;
  else if (profile.isError || !profile.data)
    body = (
      <ListError
        error={profile.error}
        notFoundText="Профиль недоступен"
        onRetry={profile.refetch}
      />
    );
  else
    body = (
      <FollowListBody
        userId={profile.data.id}
        kind={kind}
        isOwner={profile.data.isMe}
        myId={me.data?.id}
      />
    );

  return (
    <ModalShell title={TITLES[kind]} onClose={close}>
      {body}
    </ModalShell>
  );
}
