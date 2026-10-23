import { User } from 'lucide-react';
import { DEFAULT_AVATAR_SRC } from '@/lib/config';
import { cn } from '@/lib/utils';

type AvatarUser = {
  userName: string;
  avatarUrl: string | null;
  hasActiveStory?: boolean;
  isCloseFriendStory?: boolean;
};

// Аватар круглый; при активной истории вокруг него кольцо (градиент --story-ring, зелёное --close-friends
// для истории «Близким друзьям»). Для крупных размеров (≥ 64 px) зазор между кольцом и фото больше:
// 74 px в кольце 89 px (DESIGN_SYSTEM §4.2).
export function UserAvatar({
  user,
  size = 44,
  className,
}: {
  user: AvatarUser;
  size?: number;
  className?: string;
}) {
  const ring = !!user.hasActiveStory;
  const gap = size >= 64 ? 5.5 : 2; // зазор между кольцом и фото
  const ringWidth = 2;
  const outer = ring ? size + 2 * (gap + ringWidth) : size;

  const photo = user.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={user.avatarUrl}
      alt={`Фото профиля ${user.userName}`}
      className="size-full rounded-full object-cover"
    />
  ) : DEFAULT_AVATAR_SRC ? (
    // Локальная картинка «нет фото» для показа (NEXT_PUBLIC_DEFAULT_AVATAR в .env.local)
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={DEFAULT_AVATAR_SRC}
      alt={`Фото профиля ${user.userName}`}
      className="size-full rounded-full object-cover"
    />
  ) : (
    <span
      role="img"
      aria-label={`Фото профиля ${user.userName}`}
      className="flex size-full items-center justify-center rounded-full bg-background-secondary text-icon-secondary"
    >
      <User style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  );

  if (!ring) {
    return (
      <span
        className={cn('inline-block shrink-0 overflow-hidden rounded-full', className)}
        style={{ width: size, height: size }}
      >
        {photo}
      </span>
    );
  }

  return (
    <span
      data-testid="story-ring"
      data-close-friends={user.isCloseFriendStory ? 'true' : undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        user.isCloseFriendStory && 'bg-close-friends',
        className,
      )}
      style={{
        width: outer,
        height: outer,
        background: user.isCloseFriendStory ? undefined : 'var(--story-ring)',
      }}
    >
      <span
        className="flex items-center justify-center rounded-full bg-background"
        style={{ width: outer - 2 * ringWidth, height: outer - 2 * ringWidth }}
      >
        <span className="block overflow-hidden rounded-full" style={{ width: size, height: size }}>
          {photo}
        </span>
      </span>
    </span>
  );
}
