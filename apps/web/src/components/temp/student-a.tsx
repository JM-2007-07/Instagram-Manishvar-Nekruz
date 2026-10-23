'use client';

// ВРЕМЕННО: упрощённые копии компонентов Студента A, пока его frontend не влит в main.
// После слияния A этот файл заменяется ре-экспортами:
//   export { UserAvatar } from '@/features/users/components/user-avatar';
//   export { FollowButton } from '@/features/users/components/follow-button';
//   export { SaveButton } from '@/features/collections/components/save-button';
// Экраны B импортируют только отсюда, поэтому при замене меняется один файл.
// TODO(Студент A): заменить на ре-экспорты после слияния frontend A.

import { useState } from 'react';
import { Bookmark, User } from 'lucide-react';
import { baseApi } from '@/lib/api/base-api';
import type { UserSummary } from '@/lib/api/types';
import { cn } from '@/lib/utils';

const tempApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    tempSavePost: build.mutation<void, { postId: string; saved: boolean }>({
      query: ({ postId, saved }) => ({
        url: `/posts/${postId}/save`,
        method: saved ? 'PUT' : 'DELETE',
      }),
      invalidatesTags: ['Saved'],
    }),
    tempFollow: build.mutation<unknown, { userId: string; follow: boolean }>({
      query: ({ userId, follow }) => ({
        url: `/users/${userId}/follow`,
        method: follow ? 'PUT' : 'DELETE',
      }),
      invalidatesTags: ['Follow'],
    }),
  }),
});

/**
 * Аватар пользователя. ring — показывать кольцо истории, если у пользователя есть активная история
 * (градиент — непросмотренная, --close-friends — для близких друзей).
 */
export function UserAvatar({
  user,
  size = 32,
  ring = true,
  className,
}: {
  user: Pick<UserSummary, 'userName' | 'avatarUrl'> &
    Partial<Pick<UserSummary, 'hasActiveStory' | 'isCloseFriendStory'>>;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const showRing = ring && !!user.hasActiveStory;
  const image = user.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={user.avatarUrl}
      alt={`Фото профиля ${user.userName}`}
      width={size}
      height={size}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      role="img"
      aria-label={`Фото профиля ${user.userName}`}
      className="flex items-center justify-center rounded-full bg-background-secondary text-icon-secondary"
      style={{ width: size, height: size }}
    >
      <User style={{ width: size * 0.6, height: size * 0.6 }} />
    </span>
  );
  if (!showRing) return <span className={cn('inline-flex shrink-0', className)}>{image}</span>;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full p-[2px]',
        user.isCloseFriendStory ? 'bg-close-friends' : 'bg-[image:var(--story-ring)]',
        className,
      )}
    >
      <span className="rounded-full bg-background p-[2px]">{image}</span>
    </span>
  );
}

/** «Сохранить» в карточке и окне поста (F-INT-09). */
export function SaveButton({ postId, isSavedByMe }: { postId: string; isSavedByMe: boolean }) {
  const [saved, setSaved] = useState(isSavedByMe);
  const [save] = tempApi.useTempSavePostMutation();
  return (
    <button
      type="button"
      aria-label={saved ? 'Удалить' : 'Сохранить'}
      aria-pressed={saved}
      className="flex size-10 items-center justify-center hover:opacity-50"
      onClick={() => {
        const next = !saved;
        setSaved(next);
        save({ postId, saved: next })
          .unwrap()
          .catch(() => setSaved(!next));
      }}
    >
      <Bookmark className={cn('size-6', saved && 'fill-current')} />
    </button>
  );
}

/** «Подписаться» — текстовая кнопка (как в рекомендациях) или основная. */
export function FollowButton({
  userId,
  variant = 'link',
}: {
  userId: string;
  variant?: 'link' | 'primary';
}) {
  const [following, setFollowing] = useState(false);
  const [follow, { isLoading }] = tempApi.useTempFollowMutation();
  return (
    <button
      type="button"
      disabled={isLoading}
      className={cn(
        'text-12 font-semibold',
        variant === 'link'
          ? following
            ? 'text-foreground'
            : 'text-button-borderless hover:text-button-borderless-hover'
          : 'h-8 rounded-lg bg-primary px-4 text-14 text-primary-foreground hover:bg-button-primary-hover',
      )}
      onClick={() => {
        const next = !following;
        setFollowing(next);
        follow({ userId, follow: next })
          .unwrap()
          .catch(() => setFollowing(!next));
      }}
    >
      {following ? 'Подписки' : 'Подписаться'}
    </button>
  );
}
