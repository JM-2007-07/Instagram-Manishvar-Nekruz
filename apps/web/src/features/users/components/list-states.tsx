'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { getApiError } from '@/lib/api/errors';

// Скелетон списка пользователей (загрузка).
export function UserListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Загрузка" className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2">
          <div className="size-11 animate-pulse rounded-full bg-background-secondary" />
          <div className="flex flex-col gap-2">
            <div className="h-3 w-28 animate-pulse rounded bg-background-secondary" />
            <div className="h-3 w-20 animate-pulse rounded bg-background-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Пустое состояние: текст из спецификации.
export function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-10 text-center text-14 text-muted-foreground">{children}</p>;
}

// Ошибка загрузки: 404 и закрытый аккаунт — текст, остальное — «Повторить».
export function ListError({
  error,
  notFoundText = 'Не найдено',
  onRetry,
}: {
  error: unknown;
  notFoundText?: string;
  onRetry?: () => void;
}) {
  const { status, code } = getApiError(error);
  if (status === 404) return <EmptyMessage>{notFoundText}</EmptyMessage>;
  if (code === 'PRIVATE_ACCOUNT') return <EmptyMessage>Это закрытый аккаунт</EmptyMessage>;
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-14">
      <p className="text-muted-foreground">Не удалось загрузить. Попробуйте ещё раз.</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Повторить
        </Button>
      ) : null}
    </div>
  );
}

// Подгрузка следующей страницы при прокрутке до конца списка (IntersectionObserver) или по кнопке.
export function LoadMore({
  hasNextPage,
  isFetching,
  onLoad,
}: {
  hasNextPage: boolean;
  isFetching: boolean;
  onLoad: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const loadRef = useRef(onLoad);
  useEffect(() => {
    loadRef.current = onLoad;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node || !hasNextPage || isFetching || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadRef.current();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching]);

  if (!hasNextPage) return null;
  return (
    <div ref={ref} className="flex justify-center py-3">
      <Button variant="ghost" disabled={isFetching} onClick={onLoad}>
        {isFetching ? 'Загрузка…' : 'Показать ещё'}
      </Button>
    </div>
  );
}
