'use client';

import { EmptyMessage, ListError, LoadMore, UserListSkeleton } from './list-states';
import { UserListItem } from './user-list-item';

type Item = {
  id: string;
  userName: string;
  fullName?: string;
  avatarUrl: string | null;
  isVerified?: boolean;
  hasActiveStory?: boolean;
  isCloseFriendStory?: boolean;
};

// Список пользователей с тремя состояниями (загрузка → скелетон, ошибка → «Повторить», пусто → текст)
// и подгрузкой страниц. Принимает результат хука infiniteQuery «по частям», чтобы не зависеть от его типа.
export function PagedUserList<T extends Item>({
  items,
  isLoading,
  error,
  refetch,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  emptyText,
  renderAction,
  renderSubtitle,
}: {
  items: T[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  emptyText: string;
  renderAction?: (item: T) => React.ReactNode;
  renderSubtitle?: (item: T) => React.ReactNode;
}) {
  if (isLoading) return <UserListSkeleton />;
  if (error) return <ListError error={error} onRetry={refetch} />;
  if (items.length === 0) return <EmptyMessage>{emptyText}</EmptyMessage>;
  return (
    <div>
      {items.map((item) => (
        <UserListItem
          key={item.id}
          user={item}
          subtitle={renderSubtitle?.(item)}
          action={renderAction?.(item)}
        />
      ))}
      <LoadMore hasNextPage={hasNextPage} isFetching={isFetchingNextPage} onLoad={fetchNextPage} />
    </div>
  );
}
