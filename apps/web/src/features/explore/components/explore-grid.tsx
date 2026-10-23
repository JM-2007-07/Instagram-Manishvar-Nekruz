'use client';

import { useGetExploreInfiniteQuery } from '../api';
import { PostGrid } from './post-grid';

// Сетка «Интересного»: на компьютере 5 колонок плиток 3:4 (как instagram.com), на мобильном — 3.
export function ExploreGrid() {
  const { data, isLoading, isFetching, isError, hasNextPage, fetchNextPage, refetch } =
    useGetExploreInfiniteQuery();
  return (
    <PostGrid
      posts={data?.pages.flatMap((p) => p.items)}
      isLoading={isLoading}
      isError={isError}
      hasNextPage={hasNextPage}
      isFetching={isFetching}
      onLoadMore={() => void fetchNextPage()}
      onRetry={refetch}
      emptyText="Пока здесь ничего нет."
      columns={5}
    />
  );
}
