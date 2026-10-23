'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGetReelsInfiniteQuery } from '../api';
import { ReelItem } from './reel-item';
import { ReelSkeleton } from './reel-skeleton';

// Высота ленты: на мобильном вычитаем верхнюю (60) и нижнюю (50) панели.
export const reelsHeight = 'h-[calc(100dvh-110px)] md:h-dvh';

export function ReelsFeed() {
  const { data, isLoading, isFetching, isError, hasNextPage, fetchNextPage, refetch } =
    useGetReelsInfiniteQuery();
  const reels = data?.pages.flatMap((p) => p.items);
  const [muted, setMuted] = useState(true); // звук общий для всех роликов
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Подгрузка следующей страницы, когда дошли до конца списка.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetching) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void fetchNextPage();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, fetchNextPage, reels?.length]);

  function step(direction: 1 | -1) {
    const el = scrollRef.current;
    if (el) el.scrollBy({ top: direction * el.clientHeight, behavior: 'smooth' });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      step(-1);
    }
  }

  if (isLoading) {
    return (
      <div className={reelsHeight}>
        <ReelSkeleton />
      </div>
    );
  }
  if (isError && !reels) {
    return (
      <div className={`${reelsHeight} flex flex-col items-center justify-center gap-4`}>
        <p className="text-14 text-muted-foreground">Не удалось загрузить Reels.</p>
        <Button onClick={() => void refetch()}>Повторить</Button>
      </div>
    );
  }
  if (!reels || reels.length === 0) {
    return (
      <div className={`${reelsHeight} flex items-center justify-center`}>
        <p className="text-14 text-muted-foreground">Пока нет Reels</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        tabIndex={0}
        aria-label="Лента Reels"
        onKeyDown={onKeyDown}
        className={`${reelsHeight} snap-y snap-mandatory overflow-y-scroll outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
      >
        {reels.map((post) => (
          <ReelItem
            key={post.id}
            post={post}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
          />
        ))}
        <div ref={sentinelRef} className="h-px" />
      </div>
      <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-2 xl:flex">
        <button
          type="button"
          aria-label="Предыдущий ролик"
          onClick={() => step(-1)}
          className="flex size-10 items-center justify-center rounded-full bg-background-secondary hover:bg-hover-overlay"
        >
          <ChevronUp className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Следующий ролик"
          onClick={() => step(1)}
          className="flex size-10 items-center justify-center rounded-full bg-background-secondary hover:bg-hover-overlay"
        >
          <ChevronDown className="size-5" />
        </button>
      </div>
    </div>
  );
}
