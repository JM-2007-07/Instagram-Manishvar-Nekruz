'use client';

import { Button } from '@/components/ui/button';
import { showApiError } from '@/lib/api/errors';
import type { FollowRequestItem } from '@/lib/api/types';
import {
  useAcceptFollowRequestMutation,
  useDeclineFollowRequestMutation,
  useGetFollowRequestsInfiniteQuery,
} from '../api';
import { PagedUserList } from './paged-user-list';

function RequestActions({ userId }: { userId: string }) {
  const [accept, { isLoading: accepting }] = useAcceptFollowRequestMutation();
  const [decline, { isLoading: declining }] = useDeclineFollowRequestMutation();
  const busy = accepting || declining;

  async function run(action: typeof accept) {
    try {
      await action(userId).unwrap();
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <div className="flex gap-2">
      <Button disabled={busy} onClick={() => run(accept)}>
        Подтвердить
      </Button>
      <Button variant="secondary" disabled={busy} onClick={() => run(decline)}>
        Удалить
      </Button>
    </div>
  );
}

// Входящие запросы на подписку (закрытый аккаунт): «Подтвердить» / «Удалить». Страница /accounts/follow_requests/,
// тот же компонент можно встроить блоком в уведомления.
export function FollowRequestsList() {
  const query = useGetFollowRequestsInfiniteQuery();
  const items: FollowRequestItem[] = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <PagedUserList
      items={items}
      isLoading={query.isLoading}
      error={query.error}
      refetch={query.refetch}
      hasNextPage={query.hasNextPage}
      isFetchingNextPage={query.isFetchingNextPage}
      fetchNextPage={() => query.fetchNextPage()}
      emptyText="Нет запросов на подписку"
      renderAction={(item) => <RequestActions userId={item.id} />}
    />
  );
}
