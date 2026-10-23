'use client';

import { useGetExploreInfiniteQuery } from '../api';
import { PostGrid } from './post-grid';

// Сетка «Интересного»: ширина 840 на десктопе, на мобильном — во всю ширину.
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
    />
  );
}
