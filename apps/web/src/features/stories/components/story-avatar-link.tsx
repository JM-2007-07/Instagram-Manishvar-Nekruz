'use client';

import Link from 'next/link';
import { forwardRef } from 'react';
import { UserAvatar } from '@/features/users/components/user-avatar';
import { cn } from '@/lib/utils';
import { useGetUserStoriesQuery } from '../api';
import { storyPath } from '../utils';

type AvatarUser = {
  id?: string;
  userName: string;
  avatarUrl: string | null;
  hasActiveStory?: boolean;
  isCloseFriendStory?: boolean;
};

type Props = {
  user: AvatarUser;
  size: number;
  /** Куда вести, если историй нет (обычно профиль). Не задан — просто аватар. */
  fallbackHref?: string;
  className?: string;
  onClick?: () => void;
};

/**
 * Аватар с кольцом истории — один для всего приложения (лента, публикации, Reels, комментарии, рекомендации,
 * списки, профиль). Кольцо серое, если все истории просмотрены: состояние берётся из того же кэша
 * getUserStories, который обновляет просмотрщик, поэтому меняется везде сразу. Клик открывает первую
 * непросмотренную историю (или первую), а без историй — fallbackHref.
 */
export const StoryAvatar = forwardRef<HTMLAnchorElement, Props>(function StoryAvatar(props, ref) {
  const { user, size, fallbackHref, className, onClick } = props;
  if (user.hasActiveStory && user.id) return <ActiveStoryAvatar ref={ref} {...props} />;
  const avatar = <UserAvatar user={user} size={size} />;
  if (!fallbackHref) return avatar;
  return (
    <Link ref={ref} href={fallbackHref} onClick={onClick} className={cn('shrink-0', className)}>
      {avatar}
    </Link>
  );
});

// Отдельный компонент: хук запроса вызывается только у тех, у кого есть история.
const ActiveStoryAvatar = forwardRef<HTMLAnchorElement, Props>(function ActiveStoryAvatar(
  { user, size, fallbackHref, className, onClick },
  ref,
) {
  const { data: stories } = useGetUserStoriesQuery(user.id as string);
  if (!stories?.length) {
    // Истории ещё грузятся или уже истекли: обычное кольцо, клик — как без истории.
    const avatar = <UserAvatar user={user} size={size} />;
    return fallbackHref ? (
      <Link ref={ref} href={fallbackHref} onClick={onClick} className={cn('shrink-0', className)}>
        {avatar}
      </Link>
    ) : (
      avatar
    );
  }
  const firstUnseen = stories.find((s) => !s.isViewedByMe);
  return (
    <Link
      ref={ref}
      href={storyPath(user.userName, (firstUnseen ?? stories[0]!).id)}
      aria-label={`Истории ${user.userName}`}
      onClick={onClick}
      className={cn('block shrink-0 rounded-full', className)}
    >
      <UserAvatar user={user} size={size} seen={!firstUnseen} />
    </Link>
  );
});

/** Шапка профиля: то же, что StoryAvatar, без перехода при отсутствии историй. */
export function StoryAvatarLink({
  user,
  size,
}: {
  user: AvatarUser & { id: string };
  size: number;
}) {
  return <StoryAvatar user={user} size={size} />;
}
