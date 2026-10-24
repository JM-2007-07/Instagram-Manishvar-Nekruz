'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { CommentForm } from '@/features/comments/components/post-comments';
import { renderCaption, timeAgo } from '../lib';
import type { Post } from '../types';
import { usePostLike } from '../use-post-like';
import { PostActions } from './post-actions';
import { PostMedia } from './post-media';
import { PostMenu } from './post-menu';
import { StoryAvatar } from '@/features/stories/components/story-avatar-link';

// Формат медиа: по размерам первого файла (3:4 по умолчанию), в пределах 3:4 … 1.91:1.
export function mediaAspect(post: Post): number {
  const m = post.items[0]?.media;
  if (!m?.width || !m.height) return 3 / 4;
  return Math.min(1.91, Math.max(3 / 4, m.width / m.height));
}

// Карточка поста в ленте: ширина 470, медиа 468 (DESIGN_SYSTEM §4, SCREENS §3.4).
export function PostCard({ post }: { post: Post }) {
  const { liked, count, setLike } = usePostLike(post);
  const [expanded, setExpanded] = useState(false);
  const [deleted, setDeleted] = useState(false);
  if (deleted) return null;

  const href = `/p/${post.shortcode}/`;
  const caption = post.caption ?? '';
  const isLong = caption.length > 125 && !expanded;

  return (
    <article className="mx-auto w-full max-w-[470px] border-b border-border pb-4">
      <header className="flex items-center gap-3 py-3">
        <StoryAvatar user={post.author} size={32} fallbackHref={`/${post.author.userName}/`} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1 text-14">
            <Link href={`/${post.author.userName}/`} className="truncate font-semibold">
              {post.author.userName}
            </Link>
            {post.author.isVerified && (
              <BadgeCheck
                className="size-3.5 shrink-0 fill-link text-background"
                aria-label="Подтверждённый аккаунт"
              />
            )}
            <span className="text-muted-foreground">•</span>
            <time dateTime={post.publishedAt} className="text-muted-foreground">
              {timeAgo(post.publishedAt)}
            </time>
          </div>
          {post.location && (
            <Link
              href={`/explore/locations/${post.location.id}/`}
              className="truncate text-12 hover:opacity-70"
            >
              {post.location.name}
            </Link>
          )}
        </div>
        <PostMenu post={post} onDeleted={() => setDeleted(true)} />
      </header>

      <PostMedia
        items={post.items}
        onDoubleLike={() => setLike(true)}
        className="w-full max-w-[468px] rounded-sm border border-border"
        aspect={mediaAspect(post)}
      />

      <div className="pt-1">
        <PostActions
          post={post}
          liked={liked}
          onLike={() => setLike(!liked)}
          commentHref={href}
          counts={{
            likeCount: post.hideLikeCount ? null : count,
            commentCount: post.commentCount,
          }}
        />
        {caption && (
          <p className="mt-1 text-14 break-words">
            <Link href={`/${post.author.userName}/`} className="mr-1 font-semibold">
              {post.author.userName}
            </Link>
            {isLong ? renderCaption(caption.slice(0, 125).trimEnd()) : renderCaption(caption)}
            {isLong && (
              <>
                {'… '}
                <button
                  type="button"
                  className="text-muted-foreground"
                  onClick={() => setExpanded(true)}
                >
                  ещё
                </button>
              </>
            )}
          </p>
        )}
        {post.commentCount > 0 && !post.commentsDisabled && (
          <Link href={href} className="mt-1 block text-14 text-muted-foreground">
            Посмотреть все комментарии ({post.commentCount})
          </Link>
        )}
        {!post.commentsDisabled && <CommentForm post={post} variant="card" />}
      </div>
    </article>
  );
}
