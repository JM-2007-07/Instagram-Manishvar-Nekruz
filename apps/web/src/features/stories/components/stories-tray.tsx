'use client';

import { useGetCurrentUserQuery } from '@/features/posts/api';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { UserAvatar } from '@/components/temp/student-a';
import { DESIGN } from '@/lib/design';
import { cn } from '@/lib/utils';
import { useGetStoryTrayQuery } from '../api';
import { storyPath } from '../utils';
import { CreateStoryDialog } from './create-story-dialog';

type RingKind = 'unseen' | 'close-friends' | 'seen' | 'none';

// Кольцо 89 px вокруг аватара 74 px: градиент — есть непросмотренные, зелёное — близкие друзья.
// Толщина цветного кольца 3 px (как у Instagram), просмотренного серого — 1 px; остальное — зазор цвета фона.
function Ring({ kind, children }: { kind: RingKind; children: React.ReactNode }) {
  const gap = (DESIGN.storyRing - DESIGN.storyAvatar) / 2; // отступ от края до аватара
  return (
    <span
      data-ring={kind}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        kind === 'unseen' && 'bg-[image:var(--story-ring)]',
        kind === 'close-friends' && 'bg-close-friends',
        kind === 'seen' && 'bg-stroke',
      )}
      style={{ width: DESIGN.storyRing, height: DESIGN.storyRing }}
    >
      <span
        className="rounded-full bg-background"
        style={{ padding: kind === 'none' ? gap : gap - (kind === 'seen' ? 1 : 3) }}
      >
        {children}
      </span>
    </span>
  );
}

const itemClass = 'flex shrink-0 flex-col items-center gap-1 outline-none';

/** Лента историй над постами: кольца 74/89 px, шаг 104 px, стрелки на десктопе (F-STR-01). */
export function StoriesTray() {
  const { data: tray, isLoading } = useGetStoryTrayQuery();
  const { data: me } = useGetCurrentUserQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  function updateEdges() {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 0,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }
  useEffect(updateEdges, [tray]);

  if (isLoading) {
    return (
      <div className="flex gap-[15px] py-4" aria-busy="true" aria-label="Загрузка историй">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-1"
            style={{ width: DESIGN.storyRing }}
          >
            <div
              className="animate-pulse rounded-full bg-background-secondary"
              style={{ width: DESIGN.storyRing, height: DESIGN.storyRing }}
            />
            <div className="h-3 w-12 animate-pulse rounded bg-background-secondary" />
          </div>
        ))}
      </div>
    );
  }

  const own = tray?.find((t) => t.author.id === me?.id);
  const others = (tray ?? []).filter((t) => t.author.id !== me?.id);
  const scrollBy = (dx: number) => scroller.current?.scrollBy({ left: dx, behavior: 'smooth' });

  const ownAvatar = me ? (
    <UserAvatar user={me} size={DESIGN.storyAvatar} ring={false} />
  ) : (
    <span
      className="block rounded-full bg-background-secondary"
      style={{ width: DESIGN.storyAvatar, height: DESIGN.storyAvatar }}
    />
  );

  return (
    <div className="relative">
      <div
        ref={scroller}
        onScroll={updateEdges}
        className="flex gap-[15px] overflow-x-auto py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* «Ваша история» всегда первая. Есть история — фото открывает её, а «+» добавляет ещё одну
            (кнопка рядом со ссылкой, а не внутри: кнопка в ссылке недопустима) */}
        <div className="relative shrink-0" style={{ width: DESIGN.storyRing }}>
          {own ? (
            <Link
              href={storyPath(own.author.userName, own.storyIds[0])}
              aria-label="Ваша история"
              className={itemClass}
            >
              <Ring
                kind={own.hasUnseen ? (own.isCloseFriends ? 'close-friends' : 'unseen') : 'seen'}
              >
                {ownAvatar}
              </Ring>
              <span className="w-full truncate text-center text-12 text-foreground">
                Ваша история
              </span>
            </Link>
          ) : (
            <button type="button" onClick={() => setCreateOpen(true)} className={itemClass}>
              <Ring kind="none">{ownAvatar}</Ring>
              <span className="w-full truncate text-center text-12 text-foreground">
                Ваша история
              </span>
            </button>
          )}
          <button
            type="button"
            aria-label="Добавить историю"
            onClick={() => setCreateOpen(true)}
            className="absolute right-1 flex size-6 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ top: DESIGN.storyRing - 26 }}
          >
            <Plus className="size-4" />
          </button>
        </div>

        {others.map((item) => (
          <Link
            key={item.author.id}
            href={storyPath(item.author.userName, item.storyIds[0])}
            className={itemClass}
            style={{ width: DESIGN.storyRing }}
          >
            <Ring
              kind={item.hasUnseen ? (item.isCloseFriends ? 'close-friends' : 'unseen') : 'seen'}
            >
              <UserAvatar user={item.author} size={DESIGN.storyAvatar} ring={false} />
            </Ring>
            <span
              className={cn(
                'w-full truncate text-center text-12',
                item.hasUnseen ? 'text-foreground' : 'text-text-tertiary',
              )}
            >
              {item.author.userName}
            </span>
          </Link>
        ))}
      </div>

      {edges.left && (
        <button
          type="button"
          aria-label="Назад"
          onClick={() => scrollBy(-DESIGN.storyStep * 3)}
          className="absolute top-[34px] left-1 hidden size-6 items-center justify-center rounded-full bg-white text-black shadow-[var(--shadow-strong)] md:flex"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      {edges.right && (
        <button
          type="button"
          aria-label="Далее"
          onClick={() => scrollBy(DESIGN.storyStep * 3)}
          className="absolute top-[34px] right-1 hidden size-6 items-center justify-center rounded-full bg-white text-black shadow-[var(--shadow-strong)] md:flex"
        >
          <ChevronRight className="size-4" />
        </button>
      )}

      <CreateStoryDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
