'use client';

import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import {
  CommentForm,
  CommentThreadProvider,
  PostComments,
} from '@/features/comments/components/post-comments';
import { getApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { useGetPostByShortcodeQuery } from '../api';
import { formatPostDate, renderCaption, timeAgo } from '../lib';
import type { Post } from '../types';
import { usePostLike } from '../use-post-like';
import { LikeCount, PostActions } from './post-actions';
import { mediaAspect } from './post-card';
import { PostMedia } from './post-media';
import { PostMenu } from './post-menu';
import { StoryAvatar } from '@/features/stories/components/story-avatar-link';

// Окно поста: и в модальном окне, и на странице /p/{shortcode}/ (SCREENS §3.5).
export function PostView({
  shortcode,
  variant,
  onDeleted,
}: {
  shortcode: string;
  variant: 'modal' | 'page';
  onDeleted?: () => void;
}) {
  const { data: post, error, isLoading, refetch } = useGetPostByShortcodeQuery(shortcode);

  if (isLoading) return <PostViewSkeleton />;
  if (error || !post) {
    const e = getApiError(error);
    const text =
      e.code === 'PRIVATE_ACCOUNT'
        ? 'Это закрытый аккаунт'
        : e.status === 404
          ? 'К сожалению, эта страница недоступна.'
          : null;
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
        {text ? (
          <>
            <p className="text-16 font-semibold">{text}</p>
            <Link href="/" className="text-14 text-link">
              Вернуться на главную
            </Link>
          </>
        ) : (
          <>
            <p className="text-14 text-muted-foreground">Не удалось загрузить публикацию</p>
            <button type="button" onClick={refetch} className="text-14 font-semibold text-link">
              Повторить
            </button>
          </>
        )}
      </div>
    );
  }
  return <PostContent post={post} variant={variant} onDeleted={onDeleted} />;
}

function PostContent({
  post,
  variant,
  onDeleted,
}: {
  post: Post;
  variant: 'modal' | 'page';
  onDeleted?: () => void;
}) {
  const { liked, count, setLike } = usePostLike(post);
  const author = post.author;

  // Мобильный порядок (<768): шапка, медиа, кнопки, подпись и комментарии, поле.
  // Правая колонка на ≥768 — flex-колонка; на мобильном «растворяется» (contents), порядок задают order-*.
  return (
    <CommentThreadProvider postId={post.id}>
      <div
        className={cn(
          'flex flex-col bg-background-elevated max-md:max-h-[calc(100vh-40px)] max-md:overflow-y-auto md:h-[min(calc(100vh-40px),800px)] md:flex-row',
          variant === 'page' && 'mx-auto max-w-[935px] border border-border',
        )}
      >
        <PostMedia
          items={post.items}
          onDoubleLike={() => setLike(true)}
          aspect={mediaAspect(post)}
          className="order-2 w-full md:order-1 md:h-full md:w-auto md:max-w-[calc(100%-335px)] md:min-w-0 md:shrink"
        />

        <div className="contents md:order-2 md:flex md:w-[400px] md:shrink-0 md:flex-col md:border-l md:border-border">
          <header className="order-1 flex items-center gap-3 border-b border-border px-4 py-3">
            <StoryAvatar user={author} size={32} fallbackHref={`/${author.userName}/`} />
            <div className="flex min-w-0 flex-1 items-center gap-1 text-14">
              <Link href={`/${author.userName}/`} className="truncate font-semibold">
                {author.userName}
              </Link>
              {author.isVerified && (
                <BadgeCheck
                  className="size-3.5 shrink-0 fill-link text-background"
                  aria-label="Подтверждённый аккаунт"
                />
              )}
              {/* TODO(Студент A): «• Подписаться», когда FollowButton A будет знать статус подписки
                  (в Post.author его нет — кнопка с «Подписаться» по умолчанию врала бы подписчикам). */}
            </div>
            <PostMenu post={post} onDeleted={onDeleted} />
          </header>

          <div className="order-4 px-4 py-3 md:order-2 md:min-h-0 md:flex-1 md:overflow-y-auto">
            {post.caption && (
              <div className="flex gap-3 pb-4">
                <StoryAvatar user={author} size={32} fallbackHref={`/${author.userName}/`} />
                <div className="min-w-0 text-14 break-words">
                  <Link href={`/${author.userName}/`} className="mr-1 font-semibold">
                    {author.userName}
                  </Link>
                  {renderCaption(post.caption)}
                  <p className="mt-2 text-12 text-muted-foreground">{timeAgo(post.publishedAt)}</p>
                </div>
              </div>
            )}
            {post.commentsDisabled ? (
              <p className="text-center text-14 text-muted-foreground">
                Комментарии к этой публикации отключены.
              </p>
            ) : (
              <PostComments post={post} />
            )}
          </div>

          <div className="order-3 border-t border-border px-4 py-2 md:order-3">
            <PostActions post={post} liked={liked} onLike={() => setLike(!liked)} />
            {!post.hideLikeCount && <LikeCount count={count} />}
            <p className="mt-1 text-10 text-muted-foreground uppercase">
              {formatPostDate(post.publishedAt)}
            </p>
          </div>

          {!post.commentsDisabled && (
            <div className="order-5 border-t border-border md:order-4">
              <CommentForm post={post} variant="dialog" />
            </div>
          )}
        </div>
      </div>
    </CommentThreadProvider>
  );
}

function PostViewSkeleton() {
  return (
    <div
      role="status"
      aria-label="Загрузка"
      className="flex h-[400px] w-full animate-pulse flex-col md:h-[600px] md:w-[900px] md:max-w-full md:flex-row"
    >
      <div className="aspect-square bg-background-secondary md:aspect-auto md:flex-1" />
      <div className="space-y-4 p-4 md:w-[400px]">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-background-secondary" />
          <div className="h-3 w-32 rounded bg-background-secondary" />
        </div>
        <div className="h-3 w-full rounded bg-background-secondary" />
        <div className="h-3 w-2/3 rounded bg-background-secondary" />
      </div>
    </div>
  );
}
