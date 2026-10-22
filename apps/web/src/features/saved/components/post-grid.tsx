'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Post } from '@/lib/api/types';

export function postThumbnail(post: Post): string | null {
  const media = post.items[0]?.media;
  return media ? (media.thumbnailUrl ?? (media.kind === 'IMAGE' ? media.url : null)) : null;
}

// Сетка 3 в ряд, плитки 3:4 (SCREENS §3.9). Кнопка «убрать» видна при наведении и фокусе.
export function PostGrid({
  posts,
  removeLabel,
  onRemove,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  posts: Post[];
  removeLabel: string;
  onRemove: (post: Post) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
}) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinel.current;
    if (
      !node ||
      !hasNextPage ||
      isFetchingNextPage ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchNextPage();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, posts.length]);

  return (
    <>
      <ul className="grid grid-cols-3 gap-1">
        {posts.map((post) => {
          const thumb = postThumbnail(post);
          return (
            <li key={post.id} className="group relative aspect-[3/4] bg-muted">
              <Link
                href={`/p/${post.shortcode}/`}
                aria-label={`Публикация ${post.author.userName}`}
              >
                {thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt={post.items[0]?.altText ?? `Публикация ${post.author.userName}`}
                    className="size-full object-cover"
                  />
                )}
              </Link>
              <button
                type="button"
                aria-label={removeLabel}
                onClick={() => onRemove(post)}
                className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white opacity-0 outline-none group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
      <div ref={sentinel} className="h-1" />
    </>
  );
}
