'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  useGetHighlightQuery,
  useGetStoryQuery,
  useGetStoryTrayQuery,
  useGetUserStoriesQuery,
} from '../api';
import { storyPath } from '../utils';
import { StoryPlayer } from './story-player';

// Закрыть: назад, а если истории открыли по прямой ссылке — на главную.
function useClose() {
  const router = useRouter();
  return useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push('/');
  }, [router]);
}

function Unavailable({ onNext }: { onNext: () => void }) {
  // Недоступная история: показываем сообщение и сами идём дальше.
  useEffect(() => {
    const timer = setTimeout(onNext, 2000);
    return () => clearTimeout(timer);
  }, [onNext]);
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-media-backdrop text-white">
      <p className="text-16">Эта история недоступна</p>
      <Button variant="secondary" onClick={onNext}>
        Закрыть
      </Button>
    </div>
  );
}

function Loading() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-media-backdrop"
      aria-busy="true"
      aria-label="Загрузка истории"
    >
      <div className="aspect-[9/16] h-full max-h-full max-w-full animate-pulse bg-white/10 md:h-[calc(100dvh-32px)] md:rounded-lg" />
    </div>
  );
}

/** /stories/{username}/{storyId}/ — истории автора; соседние авторы берутся из ленты историй. */
export function StoryViewer({ username, storyId }: { username: string; storyId: string }) {
  const router = useRouter();
  const close = useClose();
  const tray = useGetStoryTrayQuery();
  const trayIndex = tray.data?.findIndex((t) => t.author.userName === username) ?? -1;
  const trayItem = trayIndex >= 0 ? tray.data?.[trayIndex] : undefined;

  // Автора нет в ленте (прямая ссылка) — узнаём его по самой истории.
  const single = useGetStoryQuery(storyId, { skip: !tray.data || !!trayItem });
  const authorId = trayItem?.author.id ?? single.data?.author.id;
  const list = useGetUserStoriesQuery(authorId ?? '', { skip: !authorId });

  const goAuthor = (offset: number) => {
    const item = tray.data?.[trayIndex + offset];
    return item
      ? () => router.replace(storyPath(item.author.userName, item.storyIds[0]))
      : undefined;
  };
  const nextAuthor = goAuthor(1);

  const waitingForAuthor = !authorId && !tray.isError && !single.isError;
  if (tray.isLoading || single.isLoading || list.isLoading || waitingForAuthor) return <Loading />;

  if (tray.isError || single.isError || list.isError || !list.data?.length) {
    // 404, пустой список и прочие ошибки: «недоступна» и переход дальше.
    return <Unavailable onNext={nextAuthor ?? close} />;
  }

  const startIndex = Math.max(
    0,
    list.data.findIndex((s) => s.id === storyId),
  );
  return (
    <StoryPlayer
      key={username}
      stories={list.data}
      startIndex={startIndex}
      onClose={close}
      onPrevAuthor={goAuthor(-1)}
      onNextAuthor={nextAuthor}
    />
  );
}

/** /stories/highlights/{highlightId}/ — истории актуального. */
export function HighlightViewer({ highlightId }: { highlightId: string }) {
  const close = useClose();
  const { data, isLoading, isError } = useGetHighlightQuery(highlightId);

  if (isLoading) return <Loading />;
  if (isError || !data || data.stories.length === 0) return <Unavailable onNext={close} />;
  return (
    <StoryPlayer
      stories={data.stories}
      onClose={close}
      highlight={{ id: data.id, title: data.title }}
    />
  );
}
