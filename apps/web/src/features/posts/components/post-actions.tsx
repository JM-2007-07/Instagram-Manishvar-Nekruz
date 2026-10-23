'use client';

import Link from 'next/link';
import { Heart, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { SaveButton } from '@/components/temp/student-a';
import { cn } from '@/lib/utils';
import type { Post } from '../types';

export function postUrl(shortcode: string) {
  return `${window.location.origin}/p/${shortcode}/`;
}

export async function copyPostLink(shortcode: string) {
  try {
    await navigator.clipboard.writeText(postUrl(shortcode));
    toast('Ссылка скопирована в буфер обмена');
  } catch {
    toast.error('Не удалось скопировать ссылку');
  }
}

const btn = 'flex size-10 items-center justify-center hover:opacity-50';
const withCount = 'flex h-10 items-center gap-1.5 px-2 text-14 font-semibold hover:opacity-50';

// 1234 → «1234», 12 500 → «12,5 тыс.» — как подписи у значков в ленте Instagram.
export function compactCount(n: number): string {
  return n < 10000 ? String(n) : new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(n);
}

// Ряд кнопок: Нравится, Комментировать, Поделиться, справа «Сохранить».
// В ленте (counts) рядом со значками числа лайков и комментариев; у «Поделиться» числа нет —
// API его не считает.
export function PostActions({
  post,
  liked,
  onLike,
  commentHref,
  counts,
}: {
  post: Post;
  liked: boolean;
  onLike: () => void;
  /** Числа рядом со значками (лента). likeCount = null — автор скрыл число. */
  counts?: { likeCount: number | null; commentCount: number };
  /** Если не задан — кнопка «Комментировать» не ведёт никуда (мы уже в окне поста). */
  commentHref?: string;
}) {
  return (
    <div className="-ml-2 flex items-center">
      <button
        type="button"
        aria-label={liked ? 'Не нравится' : 'Нравится'}
        aria-pressed={liked}
        onClick={onLike}
        className={counts ? withCount : btn}
      >
        <Heart className={cn('size-6', liked && 'animate-like-pop fill-badge text-badge')} />
        {!!counts?.likeCount && (
          <span data-testid="like-count">{compactCount(counts.likeCount)}</span>
        )}
      </button>
      {!post.commentsDisabled &&
        (commentHref ? (
          <Link
            href={commentHref}
            aria-label="Комментировать"
            className={counts ? withCount : btn}
          >
            <MessageCircle className="size-6" />
            {!!counts?.commentCount && (
              <span data-testid="comment-count">{compactCount(counts.commentCount)}</span>
            )}
          </Link>
        ) : (
          <span className={btn}>
            <MessageCircle className="size-6" aria-label="Комментировать" />
          </span>
        ))}
      <button
        type="button"
        aria-label="Поделиться"
        onClick={() => copyPostLink(post.shortcode)}
        className={btn}
      >
        <Send className="size-6" />
      </button>
      <div className="ml-auto -mr-2">
        <SaveButton postId={post.id} isSavedByMe={post.isSavedByMe} />
      </div>
    </div>
  );
}

// «N отметок "Нравится"»; скрыто, если автор скрыл число (likeCount = null).
export function LikeCount({ count }: { count: number | null }) {
  if (count === null) return null;
  return <p className="text-14 font-semibold">{count} отметок &quot;Нравится&quot;</p>;
}
