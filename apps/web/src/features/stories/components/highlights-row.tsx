'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { DESIGN } from '@/lib/design';
import { useGetUserHighlightsQuery } from '../api';
import { CreateHighlightDialog } from './create-highlight-dialog';

const itemStyle = { width: DESIGN.highlightStep - 15 };

/** «Актуальное» в профиле: круги 77 px в кольце 92 px, шаг 132 px (F-STR-20). */
export function HighlightsRow({ userId, isMe }: { userId: string; isMe: boolean }) {
  const { data: highlights, isLoading } = useGetUserHighlightsQuery(userId);
  const [createOpen, setCreateOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex gap-[15px] py-4" aria-busy="true" aria-label="Загрузка актуального">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-full bg-background-secondary"
            style={{ width: DESIGN.highlightRing, height: DESIGN.highlightRing }}
          />
        ))}
      </div>
    );
  }
  // У чужого профиля без актуального блок не показываем.
  if (!isMe && !highlights?.length) return null;

  return (
    <div className="flex gap-[15px] overflow-x-auto py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {isMe && (
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex shrink-0 flex-col items-center gap-2 outline-none"
          style={itemStyle}
        >
          <span
            className="flex items-center justify-center rounded-full border border-stroke"
            style={{ width: DESIGN.highlightRing, height: DESIGN.highlightRing }}
          >
            <span
              className="flex items-center justify-center rounded-full bg-background-secondary text-icon-secondary"
              style={{ width: DESIGN.highlightCircle, height: DESIGN.highlightCircle }}
            >
              <Plus className="size-8" />
            </span>
          </span>
          <span className="w-full truncate text-center text-12 font-semibold">Новое</span>
        </button>
      )}

      {highlights?.map((h) => (
        <Link
          key={h.id}
          href={`/stories/highlights/${h.id}/`}
          className="flex shrink-0 flex-col items-center gap-2 outline-none"
          style={itemStyle}
        >
          <span
            className="flex items-center justify-center rounded-full border border-stroke"
            style={{ width: DESIGN.highlightRing, height: DESIGN.highlightRing }}
          >
            {h.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={h.coverUrl}
                alt={`Обложка: ${h.title}`}
                className="rounded-full object-cover"
                style={{ width: DESIGN.highlightCircle, height: DESIGN.highlightCircle }}
              />
            ) : (
              <span
                className="rounded-full bg-background-secondary"
                style={{ width: DESIGN.highlightCircle, height: DESIGN.highlightCircle }}
              />
            )}
          </span>
          <span className="w-full truncate text-center text-12 font-semibold">{h.title}</span>
        </Link>
      ))}

      {isMe && createOpen && (
        <CreateHighlightDialog open={createOpen} onOpenChange={setCreateOpen} />
      )}
    </div>
  );
}
