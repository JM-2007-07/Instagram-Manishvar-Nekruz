'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ASPECTS, type Aspect, type DraftItem } from '../types';

// Квадратная область с кадром выбранного формата. Масштаб и сдвиг — только визуальные.
export function MediaPreview({
  items,
  index,
  aspect,
  onIndex,
  onMove,
}: {
  items: DraftItem[];
  index: number;
  aspect: Aspect;
  onIndex: (i: number) => void;
  onMove?: (offset: { x: number; y: number }) => void; // есть только на шаге «Обрезать»
}) {
  const item = items[index];
  const drag = useRef<{ x: number; y: number } | null>(null);
  const ratio = ASPECTS.find((a) => a.value === aspect)?.ratio;

  const style = {
    transform: `translate(${item.offset.x}px, ${item.offset.y}px) scale(${item.zoom})`,
  };
  const mediaClass = ratio ? 'size-full object-cover' : 'size-full object-contain';

  return (
    <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-background">
      <div
        data-testid="crop-frame"
        className="relative max-h-full max-w-full touch-none overflow-hidden"
        style={
          ratio
            ? {
                aspectRatio: ratio,
                width: aspect === '16:9' ? '100%' : undefined,
                height: aspect === '16:9' ? undefined : '100%',
              }
            : { width: '100%', height: '100%' }
        }
        onPointerDown={(e) => {
          if (!onMove) return;
          drag.current = { x: e.clientX - item.offset.x, y: e.clientY - item.offset.y };
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current && onMove)
            onMove({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
        }}
        onPointerUp={() => (drag.current = null)}
      >
        {item.isVideo ? (
          <video
            key={item.key}
            src={item.url}
            className={mediaClass}
            style={style}
            muted
            loop
            autoPlay
            playsInline
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.altText || `Файл ${index + 1} из ${items.length}`}
            draggable={false}
            className={mediaClass}
            style={style}
          />
        )}
      </div>

      {index > 0 && (
        <button
          type="button"
          aria-label="Предыдущий файл"
          onClick={() => onIndex(index - 1)}
          className="absolute top-1/2 left-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-overlay text-white"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {index < items.length - 1 && (
        <button
          type="button"
          aria-label="Следующий файл"
          onClick={() => onIndex(index + 1)}
          className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-overlay text-white"
        >
          <ChevronRight className="size-5" />
        </button>
      )}
      {items.length > 1 && (
        <div className="absolute bottom-3 flex gap-1" aria-hidden>
          {items.map((it, i) => (
            <span
              key={it.key}
              className={`size-1.5 rounded-full ${i === index ? 'bg-primary' : 'bg-white/60'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
