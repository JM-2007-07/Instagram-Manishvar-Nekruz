'use client';

import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { FollowButton, UserAvatar } from '@/components/temp/student-a';
import { useStableList } from '@/features/users/use-stable-list';
import { useGetSuggestionsQuery } from '../api';

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
          <li key={user.id} className="flex items-center gap-3">
            <Link href={`/${user.userName}/`}>
              <UserAvatar user={user} size={44} />
            </Link>
            <div className="min-w-0 flex-1 text-14">
              <Link href={`/${user.userName}/`} className="flex items-center gap-1 font-semibold">
                <span className="truncate">{user.userName}</span>
                {user.isVerified && (
                  <BadgeCheck
                    className="size-3.5 shrink-0 fill-link text-background"
                    aria-label="Подтверждённый аккаунт"
                  />
                )}
              </Link>
              <p className="truncate text-12 text-muted-foreground">
                {user.reason === 'FOLLOWED_BY' && user.followedBy
                  ? `Подписан(а): ${user.followedBy.userName}`
                  : 'Рекомендации для вас'}
              </p>
            </div>
            <FollowButton userId={user.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}
