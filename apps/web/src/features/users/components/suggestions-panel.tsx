'use client';

import Link from 'next/link';
import { useGetSuggestionsQuery } from '../api';
import { FollowButton } from './follow-button';
import { ListError, UserListSkeleton } from './list-states';
import { UserListItem } from './user-list-item';

// «Рекомендации для вас»: «Подписаны: user1» или «Популярное». limit — сколько показать (5 — справа на главной).
// showSeeAll — ссылка «Все» на /explore/people/.
export function SuggestionsPanel({
  limit = 5,
  showSeeAll = true,
}: {
  limit?: number;
  showSeeAll?: boolean;
}) {
  const { data, isLoading, error, refetch } = useGetSuggestionsQuery(limit);

  if (isLoading) return <UserListSkeleton rows={Math.min(limit, 5)} />;
  if (error) return <ListError error={error} onRetry={refetch} />;
  if (!data || data.length === 0) return null; // нет рекомендаций — блок не показываем

  return (
    <section aria-labelledby="suggestions-title">
      <div className="flex items-center justify-between px-4 py-2">
        <h2 id="suggestions-title" className="text-14 font-semibold text-muted-foreground">
          Рекомендации для вас
        </h2>
        {showSeeAll && (
          <Link
            href="/explore/people/"
            className="text-12 font-semibold hover:text-muted-foreground"
          >
            Все
          </Link>
        )}
      </div>
      {data.map((user) => (
        <UserListItem
          key={user.id}
          user={user}
          avatarSize={44}
          subtitle={
            user.reason === 'FOLLOWED_BY' && user.followedBy
              ? `Подписаны: ${user.followedBy.userName}`
              : 'Популярное'
          }
          action={<FollowButton userId={user.id} followStatus="NONE" isPrivate={user.isPrivate} />}
        />
      ))}
    </section>
  );
}
