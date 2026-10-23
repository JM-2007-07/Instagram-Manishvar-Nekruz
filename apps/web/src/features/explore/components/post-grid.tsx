'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Copy, Heart, MessageCircle, Play } from 'lucide-react';
import type { Post } from '@/features/posts/types';

// Сетка плиток 3:4, 3 колонки, промежуток 1 px (SCREENS §3.8).
type Props = {
  posts: Post[] | undefined;
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetching: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  emptyText?: string;
  /** 5 — «Интересное» на компьютере (instagram.com 2026: 5 колонок 3:4 на 1024–1808 px), иначе 3 */
  columns?: 3 | 5;
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
        <span className="absolute top-3 right-3 text-white drop-shadow" data-testid="tile-badge">
          {isVideo ? (
            // Значок Reels как у Instagram: белый скруглённый квадрат с чёрным ▶
            <span
              role="img"
              aria-label="Видео"
              className="flex size-6 items-center justify-center rounded-[6px] bg-white"
            >
              <Play className="size-3.5 fill-black text-black" />
            </span>
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
  hasNextPage,
  isFetching,
  onLoadMore,
  onRetry,
  emptyText = 'Публикаций пока нет.',
  columns = 3,
}: Props) {
  const gridClass =
    columns === 5 ? 'grid grid-cols-3 gap-px md:grid-cols-5' : 'grid grid-cols-3 gap-px';
  const sentinel = useRef<HTMLDivElement>(null);

  // Бесконечная прокрутка: когда метка внизу видна — просим следующую страницу.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage || isFetching || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) onLoadMore();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, onLoadMore]);

  if (isLoading) {
    return (
      <div className={gridClass} aria-busy="true" data-testid="grid-skeleton">
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
      <div className={gridClass}>
        {posts.map((post) => (
          <Tile key={post.id} post={post} />
        ))}
      </div>
      <div ref={sentinel} className="h-10" />
    </>
  );
}
