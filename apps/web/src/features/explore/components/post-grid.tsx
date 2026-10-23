'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Clapperboard, Copy, Heart, MessageCircle } from 'lucide-react';
import type { Post } from '@/features/posts/types';

// Сетка плиток 3:4, 3 колонки, промежуток 1 px (SCREENS §3.8).
type Props = {
  posts: Post[] | undefined;
  isLoading: boolean;
  isError: boolean;
  nextCursor: string | null | undefined;
  isFetching: boolean;
  onLoadMore: (cursor: string) => void;
  onRetry: () => void;
  emptyText?: string;
};

function Tile({ post }: { post: Post }) {
  const media = post.items[0]?.media;
  const preview = media ? (media.kind === 'VIDEO' ? media.thumbnailUrl : media.url) : null;
  const isVideo = post.type === 'REEL' || media?.kind === 'VIDEO';
  const isCarousel = post.items.length > 1;
  return (
    <Link
      href={`/p/${post.shortcode}/`}
      scroll={false}
      aria-label={`Публикация ${post.author.userName}`}
      className="group relative block aspect-[3/4] overflow-hidden bg-background-secondary"
    >
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={post.items[0]?.altText ?? `Публикация ${post.author.userName}`}
          className="size-full object-cover"
          loading="lazy"
        />
      )}
      {(isVideo || isCarousel) && (
        <span className="absolute right-2 top-2 text-white drop-shadow" data-testid="tile-badge">
          {isVideo ? (
            <Clapperboard className="size-6" aria-label="Видео" />
          ) : (
            <Copy className="size-6" aria-label="Карусель" />
          )}
        </span>
      )}
      <span className="absolute inset-0 hidden items-center justify-center gap-6 bg-black/30 text-base font-semibold text-white group-hover:flex group-focus-visible:flex">
        {post.likeCount !== null && (
          <span className="flex items-center gap-1.5">
            <Heart className="size-5 fill-white" /> {post.likeCount}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <MessageCircle className="size-5 fill-white" /> {post.commentCount}
        </span>
      </span>
    </Link>
  );
}

export function PostGrid({
  posts,
  isLoading,
  isError,
  nextCursor,
  isFetching,
  onLoadMore,
  onRetry,
  emptyText = 'Публикаций пока нет.',
}: Props) {
  const sentinel = useRef<HTMLDivElement>(null);

  // Бесконечная прокрутка: когда метка внизу видна — просим следующую страницу.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !nextCursor || isFetching || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) onLoadMore(nextCursor);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, isFetching, onLoadMore]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-px" aria-busy="true" data-testid="grid-skeleton">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse bg-background-secondary" />
        ))}
      </div>
    );
  }
  if (isError && !posts?.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-14 text-muted-foreground">Не удалось загрузить публикации.</p>
        <button type="button" onClick={onRetry} className="text-14 font-semibold text-link">
          Повторить
        </button>
      </div>
    );
  }
  if (!posts?.length) {
    return <p className="py-10 text-center text-14 text-muted-foreground">{emptyText}</p>;
  }
  return (
    <>
      <div className="grid grid-cols-3 gap-px">
        {posts.map((post) => (
          <Tile key={post.id} post={post} />
        ))}
      </div>
      <div ref={sentinel} className="h-10" />
    </>
  );
}
