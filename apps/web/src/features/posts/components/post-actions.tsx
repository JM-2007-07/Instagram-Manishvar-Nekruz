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

// Ряд кнопок: Нравится, Комментировать, Поделиться, справа «Сохранить».
export function PostActions({
  post,
  liked,
  onLike,
  commentHref,
}: {
  post: Post;
  liked: boolean;
  onLike: () => void;
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
        className={btn}
      >
        <Heart className={cn('size-6', liked && 'animate-like-pop fill-badge text-badge')} />
      </button>
      {!post.commentsDisabled &&
        (commentHref ? (
          <Link href={commentHref} aria-label="Комментировать" className={btn}>
            <MessageCircle className="size-6" />
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
