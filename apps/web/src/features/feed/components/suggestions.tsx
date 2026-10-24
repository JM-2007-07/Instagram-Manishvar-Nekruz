'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProfileHoverCard } from '@/features/profile/components/profile-hover-card';
import type { FollowStatus } from '@/lib/api/types';
import { BadgeCheck } from 'lucide-react';
import { FollowButton } from '@/components/temp/student-a';
import { useStableList } from '@/features/users/use-stable-list';
import { useGetSuggestionsQuery } from '../api';
import { StoryAvatar } from '@/features/stories/components/story-avatar-link';

// Список рекомендованных аккаунтов (правая колонка и экран «Добро пожаловать»).
export function Suggestions({ limit = 5, title = true }: { limit?: number; title?: boolean }) {
  const { data: fresh, isLoading } = useGetSuggestionsQuery({ limit });
  // После подписки человек остаётся в списке, кнопка становится «Подписки» (как в Instagram).
  const data = useStableList(fresh);

  if (isLoading) {
    return (
      <div role="status" aria-label="Загрузка" className="animate-pulse space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="size-11 rounded-full bg-background-secondary" />
            <div className="h-3 w-32 rounded bg-background-secondary" />
          </div>
        ))}
      </div>
    );
  }
  if (data.length === 0) return null;

  return (
    <section>
      {title && (
        <div className="mb-3 flex items-center justify-between text-14">
          <h2 className="font-semibold text-muted-foreground">Рекомендации для вас</h2>
          <Link href="/explore/people/" className="text-12 font-semibold hover:opacity-60">
            Все
          </Link>
        </div>
      )}
      <ul className="space-y-3">
        {data.map((user) => (
          <SuggestionItem key={user.id} user={user} />
        ))}
      </ul>
    </section>
  );
}

type Suggestion = NonNullable<ReturnType<typeof useGetSuggestionsQuery>['data']>[number];

// Строка рекомендации. Наведение на фото или имя — карточка профиля (как в Instagram);
// кнопка в строке и в карточке показывают одно состояние подписки.
function SuggestionItem({ user }: { user: Suggestion }) {
  const [status, setStatus] = useState<FollowStatus>('NONE');
  const card = (node: React.ReactElement) => (
    <ProfileHoverCard userName={user.userName} followStatus={status} onFollowChange={setStatus}>
      {node}
    </ProfileHoverCard>
  );
  return (
    <li className="flex items-center gap-3">
      {card(<StoryAvatar user={user} size={44} fallbackHref={`/${user.userName}/`} />)}
      <div className="min-w-0 flex-1 text-14">
        {card(
          <Link href={`/${user.userName}/`} className="flex items-center gap-1 font-semibold">
            <span className="truncate">{user.userName}</span>
            {user.isVerified && (
              <BadgeCheck
                className="size-3.5 shrink-0 fill-link text-background"
                aria-label="Подтверждённый аккаунт"
              />
            )}
          </Link>,
        )}
        <p className="truncate text-12 text-muted-foreground">
          {user.reason === 'FOLLOWED_BY' && user.followedBy
            ? `Подписан(а): ${user.followedBy.userName}`
            : 'Рекомендации для вас'}
        </p>
      </div>
      <FollowButton
        userId={user.id}
        followStatus={status}
        isPrivate={user.isPrivate}
        onStatusChange={setStatus}
        variant="link"
      />
    </li>
  );
}
