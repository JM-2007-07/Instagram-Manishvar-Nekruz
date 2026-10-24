'use client';

import Link from 'next/link';
import { APP_NAME } from '@/lib/config';
import { useGetCurrentUserQuery } from '@/features/posts/api';
import { Suggestions } from './suggestions';
import { StoryAvatar } from '@/features/stories/components/story-avatar-link';

// Правая колонка главной (только ≥ 1264 px): свой аккаунт, рекомендации, подвал.
export function HomeSidebar() {
  const { data: me } = useGetCurrentUserQuery();
  return (
    <aside className="hidden w-[319px] shrink-0 pt-8 pl-16 min-[1264px]:block">
      {me && (
        <div className="mb-4 flex items-center gap-3">
          <StoryAvatar user={me} size={44} fallbackHref={`/${me.userName}/`} />
          <div className="min-w-0 text-14">
            <Link href={`/${me.userName}/`} className="block truncate font-semibold">
              {me.userName}
            </Link>
            <p className="truncate text-muted-foreground">{me.fullName}</p>
          </div>
        </div>
      )}
      <Suggestions />
      <p className="mt-8 text-12 text-text-tertiary">
        © {new Date().getFullYear()} {APP_NAME}
      </p>
    </aside>
  );
}
