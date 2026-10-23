'use client';

import Link from 'next/link';
import { Bookmark, Clapperboard, Grid3x3, Lock, UserRound, UserSquare2 } from 'lucide-react';
import { getApiError } from '@/lib/api/errors';
import type { Profile } from '@/lib/api/types';
import { DESIGN } from '@/lib/design';
import { cn } from '@/lib/utils';
import {
  useGetProfileByUserNameQuery,
  useGetUserPostsInfiniteQuery,
  useGetUserReelsInfiniteQuery,
  useGetUserTaggedInfiniteQuery,
} from '../api';
import { SavedTab } from '@/features/saved/components/saved-page';
import { EmptyOrError } from './empty-or-error';
import { PostTiles } from './post-tiles';
import { ProfileHeader } from './profile-header';

export type ProfileTab = 'posts' | 'reels' | 'saved' | 'tagged';

function PostsTab({ profile }: { profile: Profile }) {
  const q = useGetUserPostsInfiniteQuery(profile.id);
  return (
    <PostTiles
      pages={q.data?.pages}
      isLoading={q.isLoading}
      isError={q.isError}
      refetch={q.refetch}
      hasNextPage={q.hasNextPage}
      isFetchingNextPage={q.isFetchingNextPage}
      fetchNextPage={q.fetchNextPage}
      emptyTitle={profile.isMe ? 'Поделитесь фото' : 'Публикаций пока нет'}
      emptyHint={profile.isMe ? 'Здесь будут ваши фото и видео.' : undefined}
    />
  );
}

function ReelsTab({ profile }: { profile: Profile }) {
  const q = useGetUserReelsInfiniteQuery(profile.id);
  return (
    <PostTiles
      pages={q.data?.pages}
      isLoading={q.isLoading}
      isError={q.isError}
      refetch={q.refetch}
      hasNextPage={q.hasNextPage}
      isFetchingNextPage={q.isFetchingNextPage}
      fetchNextPage={q.fetchNextPage}
      emptyTitle="Reels пока нет"
    />
  );
}

function TaggedTab({ profile }: { profile: Profile }) {
  const q = useGetUserTaggedInfiniteQuery(profile.id);
  return (
    <PostTiles
      pages={q.data?.pages}
      isLoading={q.isLoading}
      isError={q.isError}
      refetch={q.refetch}
      hasNextPage={q.hasNextPage}
      isFetchingNextPage={q.isFetchingNextPage}
      fetchNextPage={q.fetchNextPage}
      emptyTitle="Нет отметок"
      emptyHint="Здесь появятся публикации, где отмечен пользователь."
    />
  );
}

function Tabs({ profile, tab }: { profile: Profile; tab: ProfileTab }) {
  const base = `/${profile.userName}/`;
  const items = [
    { key: 'posts', label: 'Публикации', href: base, icon: Grid3x3 },
    { key: 'reels', label: 'Reels', href: `${base}reels/`, icon: Clapperboard },
    ...(profile.isMe
      ? [{ key: 'saved', label: 'Сохранённое', href: `${base}saved/`, icon: Bookmark }]
      : []),
    { key: 'tagged', label: 'Отметки', href: `${base}tagged/`, icon: UserSquare2 },
  ];
  // Как у Instagram: только значки 24 px; активная вкладка — линия 1.6 px снизу.
  return (
    <nav
      aria-label="Разделы профиля"
      className="flex justify-around border-b-[0.8px] border-separator md:justify-center md:gap-[133px]"
    >
      {items.map(({ key, label, href, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === tab ? 'page' : undefined}
          aria-label={label}
          title={label}
          className={cn(
            'flex w-16 items-center justify-center border-b-[1.6px]',
            key === tab
              ? 'border-foreground text-foreground'
              : 'border-transparent text-icon-secondary hover:text-foreground',
          )}
          style={{ height: DESIGN.profileTabsHeight }}
        >
          <Icon className="size-6" aria-hidden />
        </Link>
      ))}
    </nav>
  );
}

export function ProfilePage({ userName, tab }: { userName: string; tab: ProfileTab }) {
  const { data: profile, isLoading, error, refetch } = useGetProfileByUserNameQuery(userName);

  if (isLoading) {
    return (
      <div
        className="mx-auto w-full px-4 py-8"
        style={{ maxWidth: DESIGN.profileContainer }}
        aria-busy="true"
      >
        <div className="mx-auto flex max-w-[636px] items-center gap-7">
          <div className="size-[77px] shrink-0 animate-pulse rounded-full bg-background-secondary md:size-[150px]" />
          <div className="flex-1 space-y-4">
            <div className="h-6 w-48 animate-pulse rounded bg-background-secondary" />
            <div className="h-5 w-72 animate-pulse rounded bg-background-secondary" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    const apiError = error ? getApiError(error) : null;
    // 404 (нет пользователя или блокировка) — одинаковый экран, чтобы не раскрывать блокировку.
    if (apiError?.status === 404) {
      return (
        <EmptyOrError
          icon={UserRound}
          title="К сожалению, эта страница недоступна"
          hint="Возможно, ссылка неверна или страница удалена."
        />
      );
    }
    return <EmptyOrError onRetry={refetch} />;
  }

  const locked = profile.isPrivate && !profile.canViewContent;

  return (
    <div className="mx-auto w-full pb-10" style={{ maxWidth: DESIGN.profileContainer }}>
      <ProfileHeader profile={profile} />
      <div className="h-6 md:h-[42px]" />
      {locked ? (
        <div className="border-t-[0.8px] border-separator">
          <EmptyOrError
            icon={Lock}
            title="Это закрытый аккаунт"
            hint="Подпишитесь, чтобы видеть публикации."
          />
        </div>
      ) : (
        <>
          <Tabs profile={profile} tab={tab} />
          {tab === 'posts' && <PostsTab profile={profile} />}
          {tab === 'reels' && <ReelsTab profile={profile} />}
          {tab === 'saved' && <SavedTab username={profile.userName} />}
          {tab === 'tagged' && <TaggedTab profile={profile} />}
        </>
      )}
    </div>
  );
}
