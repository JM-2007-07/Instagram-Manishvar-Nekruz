'use client';

import Link from 'next/link';
import { UserAvatar } from '@/features/users/components/user-avatar';
import { useGetUserStoriesQuery } from '../api';
import { storyPath } from '../utils';

type AvatarUser = {
  id: string;
  userName: string;
  avatarUrl: string | null;
  hasActiveStory?: boolean;
  isCloseFriendStory?: boolean;
};

/**
 * Аватар с кольцом истории, который открывает истории автора (шапка профиля).
 * Открывает первую непросмотренную; если всё просмотрено — кольцо серое, показ с первой.
 */
export function StoryAvatarLink({ user, size }: { user: AvatarUser; size: number }) {
  const { data: stories } = useGetUserStoriesQuery(user.id, { skip: !user.hasActiveStory });
  if (!user.hasActiveStory || !stories?.length) return <UserAvatar user={user} size={size} />;

  const firstUnseen = stories.find((s) => !s.isViewedByMe);
  return (
    <Link
      href={storyPath(user.userName, (firstUnseen ?? stories[0]!).id)}
      aria-label={`Истории ${user.userName}`}
      className="block rounded-full"
    >
      <UserAvatar user={user} size={size} seen={!firstUnseen} />
    </Link>
  );
}
