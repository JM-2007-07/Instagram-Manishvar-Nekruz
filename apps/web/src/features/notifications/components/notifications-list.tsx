'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Heart, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useGetBadgesQuery,
  useGetNotificationsInfiniteQuery,
  useMarkNotificationsReadMutation,
} from '../api';
import { groupNotifications } from '../group';
import { NotificationItem } from './notification-item';

// Страницу «Запросы на подписку» делает функция follows (docs/features/follows.md).
export const FOLLOW_REQUESTS_HREF = '/accounts/follow_requests/';

function NotificationsSkeleton() {
  return (
    <div aria-label="Загрузка" className="flex flex-col gap-4 px-6 py-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex animate-pulse items-center gap-3">
          <div className="size-11 rounded-full bg-muted" />
          <div className="h-4 flex-1 rounded bg-muted" />
          <div className="size-11 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// Содержимое панели и мобильной страницы: запросы, группы по времени, пустое состояние.
export function NotificationsList() {
  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useGetNotificationsInfiniteQuery();
  const { data: badges } = useGetBadgesQuery();
  const [markRead] = useMarkNotificationsReadMutation();
  const sentinel = useRef<HTMLDivElement>(null);

  // Открытие панели отмечает всё прочитанным (F-NTF-04). Один раз за показ.
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    markRead()
      .unwrap()
      .catch(() => undefined);
  }, [markRead]);

  // Подгрузка следующей страницы, когда конец списка виден.
  useEffect(() => {
    const node = sentinel.current;
    if (
      !node ||
      !hasNextPage ||
      isFetchingNextPage ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchNextPage();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, data]);

  if (isLoading) return <NotificationsSkeleton />;

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <p className="text-14 text-muted-foreground">Не удалось загрузить уведомления</p>
        <Button onClick={() => void refetch()}>Повторить</Button>
      </div>
    );
  }

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const groups = groupNotifications(items);
  const requests = badges?.followRequests ?? 0;

  return (
    <div>
      {requests > 0 && (
        <Link
          href={FOLLOW_REQUESTS_HREF}
          className="flex items-center gap-3 px-6 py-3 hover:bg-hover-overlay"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-muted">
            <UserPlus className="size-5" />
          </span>
          <span className="flex-1 text-14">
            <span className="block font-semibold">Запросы на подписку</span>
            <span className="block text-muted-foreground">{requests}</span>
          </span>
        </Link>
      )}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex size-24 items-center justify-center rounded-full border-2 border-foreground">
            <Heart className="size-12" />
          </span>
          <h2 className="text-20 font-semibold">Действия с вашими публикациями</h2>
          <p className="text-14 text-muted-foreground">
            Когда кто-нибудь поставит лайк или прокомментирует вашу публикацию, вы увидите это
            здесь.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h2 className="px-6 pt-4 pb-2 text-16 leading-5 font-bold">{group.title}</h2>
            <ul>
              {group.items.map((item) => (
                <NotificationItem key={item.id} item={item} />
              ))}
            </ul>
          </section>
        ))
      )}
      <div ref={sentinel} className="h-1" />
    </div>
  );
}
