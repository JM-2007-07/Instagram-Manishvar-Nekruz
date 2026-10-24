'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProfileHoverCard } from '@/features/profile/components/profile-hover-card';
import type { FollowStatus } from '@/lib/api/types';
import { useGetPeopleSuggestionsQuery } from '../api';
import { useStableList } from '../use-stable-list';
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
  const { data: fresh, isLoading, error, refetch } = useGetPeopleSuggestionsQuery(limit);
  // После подписки человек остаётся в списке, кнопка становится «Подписки» (как в Instagram).
  const data = useStableList(fresh);

  if (isLoading) return <UserListSkeleton rows={Math.min(limit, 5)} />;
  if (error) return <ListError error={error} onRetry={refetch} />;
  if (data.length === 0) return null; // нет рекомендаций — блок не показываем

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
        <SuggestionRow key={user.id} user={user} />
      ))}
    </section>
  );
}

type Suggestion = NonNullable<ReturnType<typeof useGetPeopleSuggestionsQuery>['data']>[number];

// Строка рекомендации: при наведении на фото или имя — карточка профиля; кнопка в строке
// и в карточке показывают одно состояние подписки.
function SuggestionRow({ user }: { user: Suggestion }) {
  const [status, setStatus] = useState<FollowStatus>('NONE');
  return (
    <UserListItem
      user={user}
      avatarSize={44}
      subtitle={
        user.reason === 'FOLLOWED_BY' && user.followedBy
          ? `Подписаны: ${user.followedBy.userName}`
          : 'Популярное'
      }
      wrapLink={(link) => (
        <ProfileHoverCard userName={user.userName} followStatus={status} onFollowChange={setStatus}>
          {link}
        </ProfileHoverCard>
      )}
      action={
        <FollowButton
          userId={user.id}
          followStatus={status}
          isPrivate={user.isPrivate}
          onStatusChange={setStatus}
        />
      }
    />
  );
}
