import { FollowButton } from '@/features/users/components/follow-button';
import { UserAvatar } from '@/features/users/components/user-avatar';
import type { UserSummary } from '@/lib/api/types';

// Тонкая прослойка над общими компонентами пользователя (features/users): весь стык с ними в одном месте.

export function NotificationAvatar({ user }: { user: UserSummary }) {
  return <UserAvatar user={user} size={44} />;
}

// В уведомлении о подписке статус «подписан ли я в ответ» не приходит — начинаем с «Подписаться».
export function NotificationFollowButton({ user }: { user: UserSummary }) {
  return <FollowButton userId={user.id} followStatus="NONE" isPrivate={user.isPrivate} />;
}
