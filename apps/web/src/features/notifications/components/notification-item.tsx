import Link from 'next/link';
import type { Notification } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { formatAge } from '../group';
import { NotificationAvatar, NotificationFollowButton } from './notification-parts';

// Тексты по типам (features/notifications.md). Имена авторов выводятся отдельно, жирным.
const ACTIONS: Record<Notification['type'], string> = {
  POST_LIKE: 'нравится ваша публикация.',
  COMMENT_LIKE: 'нравится ваш комментарий',
  COMMENT: 'оставил(а) комментарий',
  COMMENT_REPLY: 'ответил(а) на ваш комментарий',
  MENTION_POST: 'упомянул(а) вас в публикации.',
  MENTION_COMMENT: 'упомянул(а) вас в комментарии',
  MENTION_STORY: 'упомянул(а) вас в истории.',
  POST_TAG: 'отметил(а) вас в публикации.',
  FOLLOW: 'подписался(-ась) на ваши обновления.',
  FOLLOW_REQUEST: 'хочет подписаться на ваши обновления.',
  FOLLOW_ACCEPTED: 'принял(а) ваш запрос на подписку.',
  COLLAB_INVITE: 'приглашает вас стать соавтором публикации.',
};

// «a, b и ещё 5» — до двух имён, остальные числом.
function Names({ item }: { item: Notification }) {
  const shown = item.actors.slice(0, 2);
  const rest = item.actorCount - shown.length;
  return (
    <>
      {shown.map((actor, index) => (
        <span key={actor.id}>
          {index > 0 && (rest > 0 ? ', ' : ' и ')}
          <Link href={`/${actor.userName}/`} className="font-semibold">
            {actor.userName}
          </Link>
        </span>
      ))}
      {rest > 0 && <span className="font-semibold"> и ещё {rest}</span>}
    </>
  );
}

export function NotificationItem({ item }: { item: Notification }) {
  const first = item.actors[0];
  const target = item.post ? `/p/${item.post.shortcode}/` : first ? `/${first.userName}/` : '/';
  const commentText = item.comment?.text;

  return (
    <li
      className={cn('flex items-center gap-3 px-6 py-2', !item.isRead && 'bg-background-highlight')}
    >
      {first && <NotificationAvatar user={first} />}
      <p className="min-w-0 flex-1 text-14 break-words">
        <Names item={item} /> {ACTIONS[item.type]}
        {commentText && (
          <>
            {': '}
            <Link href={target}>{commentText}</Link>
          </>
        )}{' '}
        <time dateTime={item.createdAt} className="text-muted-foreground">
          {formatAge(item.createdAt)}
        </time>
      </p>
      {item.type === 'FOLLOW' && first ? (
        <NotificationFollowButton user={first} />
      ) : item.post?.thumbnailUrl ? (
        <Link href={target} aria-label="Открыть публикацию" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.post.thumbnailUrl}
            alt="Миниатюра публикации"
            className="size-11 rounded object-cover"
          />
        </Link>
      ) : null}
    </li>
  );
}
