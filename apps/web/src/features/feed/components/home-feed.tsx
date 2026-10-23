'use client';

import { useEffect, useRef, useState } from 'react';
import { StoriesTray } from '@/features/stories/components/stories-tray';
import { useGetFeedQuery } from '@/features/posts/api';
import { PostCard } from '@/features/posts/components/post-card';
import { getApiError } from '@/lib/api/errors';
import { HomeSidebar } from './home-sidebar';
import { Suggestions } from './suggestions';

function PostSkeleton() {
  return (
    <div
      role="status"
      aria-label="Загрузка"
      className="mx-auto w-full max-w-[470px] animate-pulse pb-6"
    >
      <div className="flex items-center gap-3 py-3">
        <div className="size-8 rounded-full bg-background-secondary" />
        <div className="h-3 w-32 rounded bg-background-secondary" />
      </div>
      <div className="aspect-[3/4] w-full max-w-[468px] bg-background-secondary" />
      <div className="mt-3 h-3 w-24 rounded bg-background-secondary" />
    </div>
  );
}

// Главная: колонка 630 px (истории + карточки) и правая колонка ≥ 1264 px.
export function HomeFeed() {
  const [cursor, setCursor] = useState<string | null>(null);
  const { data, error, isLoading, isFetching, refetch } = useGetFeedQuery({ cursor });
  const sentinel = useRef<HTMLDivElement>(null);
  const nextCursor = data?.nextCursor ?? null;

  // Бесконечная прокрутка: когда низ списка виден — просим следующую страницу.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !nextCursor || isFetching) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setCursor(nextCursor);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, isFetching]);

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <>
        <PostSkeleton />
        <PostSkeleton />
      </>
    );
  } else if (error && !data) {
    content = (
      <div className="py-16 text-center">
        <p className="text-14 text-muted-foreground">
          {getApiError(error).status === null
            ? 'Нет соединения. Проверьте сеть.'
            : 'Не удалось загрузить ленту'}
        </p>
        <button type="button" onClick={refetch} className="mt-3 text-14 font-semibold text-link">
          Повторить
        </button>
      </div>
    );
  } else if (data && data.items.length === 0) {
    content = (
      <div className="mx-auto max-w-[470px] py-8">
        <h1 className="text-20 font-semibold">Добро пожаловать</h1>
        <p className="mt-1 mb-6 text-14 text-muted-foreground">
          Подпишитесь на аккаунты, чтобы видеть их публикации в ленте.
        </p>
        <Suggestions limit={10} />
      </div>
    );
  } else if (data) {
    content = (
      <>
        {data.items.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {nextCursor ? (
          <>
            <div ref={sentinel} className="h-px" />
            {isFetching && <PostSkeleton />}
          </>
        ) : (
          <p className="py-8 text-center text-14 text-muted-foreground">Вы всё посмотрели</p>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full justify-center px-4 pt-4 md:pt-8 min-[1264px]:max-w-[949px]">
      <div className="w-full max-w-[630px] min-w-0">
        <StoriesTray />
        {content}
      </div>
      <HomeSidebar />
    </div>
  );
}
