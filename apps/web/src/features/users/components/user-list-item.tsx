import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { StoryAvatar } from '@/features/stories/components/story-avatar-link';

type ListUser = {
  id?: string;
  userName: string;
  fullName?: string;
  avatarUrl: string | null;
  isVerified?: boolean;
  hasActiveStory?: boolean;
  isCloseFriendStory?: boolean;
};

// Строка пользователя: аватар, имя пользователя с галочкой, подпись (по умолчанию fullName), справа — действие.
export function UserListItem({
  user,
  subtitle,
  action,
  avatarSize = 44,
  onNavigate,
  wrapLink,
}: {
  user: ListUser;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  avatarSize?: number;
  onNavigate?: () => void; // например, закрыть окно или панель при переходе
  /** Обёртка ссылки (аватар + имя), например карточка профиля при наведении. */
  wrapLink?: (link: React.ReactElement) => React.ReactNode;
}) {
  const caption = subtitle ?? user.fullName;
  const href = `/${user.userName}/`;
  // Аватар — отдельная ссылка: на историю, если она есть (кольцо), иначе на профиль; имя — на профиль.
  const link = (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <StoryAvatar user={user} size={avatarSize} fallbackHref={href} onClick={onNavigate} />
      <Link
        href={href}
        onClick={onNavigate}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1 text-14 font-semibold">
            <span className="truncate">{user.userName}</span>
            {user.isVerified && (
              <BadgeCheck
                aria-label="Подтверждённый аккаунт"
                className="size-3.5 shrink-0 fill-primary text-primary-foreground"
              />
            )}
          </span>
          {caption ? (
            <span className="truncate text-14 text-muted-foreground">{caption}</span>
          ) : null}
        </span>
      </Link>
    </div>
  );
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      {wrapLink ? wrapLink(link) : link}
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
