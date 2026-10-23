'use client';

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Heart, Volume2, VolumeX } from 'lucide-react';
import type { PostItem } from '../types';
import { cn } from '@/lib/utils';

type Props = {
  items: PostItem[];
  /** Двойной клик/тап по медиа: ставим лайк и показываем большое сердце. */
  onDoubleLike?: () => void;
  /** Классы контейнера: размер задаёт вызывающий. */
  className?: string;
  /** Отношение ширины к высоте (по умолчанию заполняет контейнер). */
  aspect?: number;
};

// Карусель: стрелки ‹ ›, точки, свайп на мобильном; видео — autoplay muted loop, звук по клику.
export function PostMedia({ items, onDoubleLike, className, aspect }: Props) {
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [heartKey, setHeartKey] = useState(0); // 0 — сердца нет
  const touchX = useRef<number | null>(null);
  const item = items[index];
  const go = (d: number) => setIndex((i) => Math.min(items.length - 1, Math.max(0, i + d)));
  if (!item) return null;

  function onDoubleClick() {
    onDoubleLike?.();
    setHeartKey((k) => k + 1);
    setTimeout(() => setHeartKey(0), 1000);
  }

  const arrow =
    'absolute top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-black hover:bg-white';

  return (
    <div
      className={cn('relative overflow-hidden bg-media-backdrop select-none', className)}
      style={aspect ? { aspectRatio: aspect } : undefined}
      onDoubleClick={onDoubleClick}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
    >
      {item.media.kind === 'VIDEO' ? (
        <video
          key={item.media.id}
          src={item.media.url}
          poster={item.media.thumbnailUrl ?? undefined}
          autoPlay
          loop
          playsInline
          muted={muted}
          aria-label={item.altText ?? 'Видео публикации'}
          className="size-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.media.url}
          alt={item.altText ?? 'Фото публикации'}
          draggable={false}
          className="size-full object-cover"
        />
      )}

      {item.media.kind === 'VIDEO' && (
        <button
          type="button"
          aria-label={muted ? 'Включить звук' : 'Выключить звук'}
          onClick={() => setMuted((m) => !m)}
          className="absolute right-3 bottom-3 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      )}

      {index > 0 && (
        <button
          type="button"
          aria-label="Назад"
          onClick={() => go(-1)}
          className={cn(arrow, 'left-2')}
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {index < items.length - 1 && (
        <button
          type="button"
          aria-label="Далее"
          onClick={() => go(1)}
          className={cn(arrow, 'right-2')}
        >
          <ChevronRight className="size-5" />
        </button>
      )}

      {items.length > 1 && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1"
          aria-hidden
        >
          {items.map((it, i) => (
            <span
              key={it.position}
              data-testid="dot"
              data-active={i === index}
              className={cn('size-1.5 rounded-full', i === index ? 'bg-white' : 'bg-white/40')}
            />
          ))}
        </div>
      )}
      {heartKey > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Heart
            key={heartKey}
            data-testid="big-heart"
            className="size-24 fill-white text-white drop-shadow-lg animate-in zoom-in-0 fade-in duration-300"
          />
        </div>
      )}
    </div>
  );
}
