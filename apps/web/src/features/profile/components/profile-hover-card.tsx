'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Camera, Lock } from 'lucide-react';
import { HoverCard } from 'radix-ui';
import { FollowButton } from '@/features/users/components/follow-button';
import { UserAvatar } from '@/features/users/components/user-avatar';
import type { FollowStatus } from '@/lib/api/types';
import { useGetProfileByUserNameQuery, useGetUserPostsInfiniteQuery } from '../api';
import { formatCount } from '../format';

function Count({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-16 font-semibold">{formatCount(value)}</span>
      <span className="text-14">{label}</span>
    </div>
  );
}

// Содержимое карточки: грузится только при открытии (профиль и первые 3 публикации).
function CardBody({
  userName,
  followStatus,
  onFollowChange,
}: {
  userName: string;
  followStatus?: FollowStatus;
  onFollowChange?: (status: FollowStatus) => void;
}) {
  const { data: profile, isLoading, isError } = useGetProfileByUserNameQuery(userName);
  const posts = useGetUserPostsInfiniteQuery(profile?.id ?? '', {
    skip: !profile?.canViewContent || !profile.postCount,
  });

  if (isLoading) {
    return (
      <div className="flex animate-pulse items-center gap-4 p-4" aria-busy="true">
        <div className="size-14 rounded-full bg-background-secondary" />
        <div className="h-4 w-32 rounded bg-background-secondary" />
      </div>
    );
  }
  if (isError || !profile) return <p className="p-4 text-14">Профиль недоступен</p>;

  const href = `/${profile.userName}/`;
  const items = posts.data?.pages.flatMap((p) => p.items).slice(0, 3) ?? [];

  return (
    <div className="flex flex-col gap-4 p-4">
      <Link href={href} className="flex items-center gap-4">
        <UserAvatar user={profile} size={56} />
        <span className="min-w-0">
          <span className="block truncate text-16 font-semibold">{profile.userName}</span>
          {profile.fullName && (
            <span className="block truncate text-14 text-muted-foreground">{profile.fullName}</span>
          )}
        </span>
      </Link>

      <div className="grid grid-cols-3">
        <Count value={profile.postCount} label="публикации" />
        <Count value={profile.followerCount} label="подписчики" />
        <Count value={profile.followingCount} label="подписки" />
      </div>

      {!profile.canViewContent ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-full border-2 border-foreground">
            <Lock className="size-6" />
          </span>
          <p className="text-14 font-semibold">Это закрытый аккаунт</p>
          <p className="text-14 text-muted-foreground">
            Подпишитесь, чтобы видеть фото и видео {profile.userName}.
          </p>
        </div>
      ) : profile.postCount === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          {/* кольцо в цветах истории, как у Instagram */}
          <span className="rounded-full bg-[image:var(--story-ring)] p-[2px]">
            <span className="flex size-14 items-center justify-center rounded-full bg-popover">
              <Camera className="size-7" />
            </span>
          </span>
          <p className="text-16 font-semibold">Публикаций пока нет</p>
          <p className="text-14 text-muted-foreground">
            Здесь будут показаны фото и видео {profile.userName}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5">
          {items.map((post) => {
            const media = post.items[0]?.media;
            const src = media?.thumbnailUrl ?? (media?.kind === 'IMAGE' ? media.url : null);
            return (
              <Link
                key={post.id}
                href={`/p/${post.shortcode}/`}
                className="aspect-square bg-background-secondary"
              >
                {src && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="size-full object-cover" />
                )}
              </Link>
            );
          })}
        </div>
      )}

      {!profile.isMe && (
        <FollowButton
          userId={profile.id}
          followStatus={followStatus ?? profile.followStatus}
          isPrivate={profile.isPrivate}
          onStatusChange={onFollowChange}
          className="h-8 w-full"
        />
      )}
    </div>
  );
}

/**
 * Карточка профиля при наведении (как у Instagram в рекомендациях): фото, имя, счётчики,
 * 3 последние публикации или «Публикаций пока нет», кнопка подписки на всю ширину.
 * followStatus/onFollowChange — общее состояние с кнопкой в строке списка.
 */
export function ProfileHoverCard({
  userName,
  followStatus,
  onFollowChange,
  children,
}: {
  userName: string;
  followStatus?: FollowStatus;
  onFollowChange?: (status: FollowStatus) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <HoverCard.Root open={open} onOpenChange={setOpen} openDelay={400} closeDelay={150}>
      <HoverCard.Trigger asChild>{children}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 w-[366px] max-w-[calc(100vw-32px)] rounded-2xl bg-popover text-popover-foreground shadow-[var(--shadow-strong)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        >
          {open && (
            <CardBody
              userName={userName}
              followStatus={followStatus}
              onFollowChange={onFollowChange}
            />
          )}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
