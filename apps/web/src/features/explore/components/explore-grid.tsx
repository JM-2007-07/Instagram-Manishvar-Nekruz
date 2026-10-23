'use client';

import { useState } from 'react';
import { useGetExploreQuery } from '../api';
import { PostGrid } from './post-grid';

// Сетка «Интересного»: ширина 840 на десктопе, на мобильном — во всю ширину.
export function ExploreGrid() {
  const [cursor, setCursor] = useState<string | null>(null);
  const { data, isLoading, isFetching, isError, refetch } = useGetExploreQuery({ cursor });
  return (
    <PostGrid
      posts={data?.items}
      isLoading={isLoading}
      isError={isError}
      nextCursor={data?.nextCursor}
      isFetching={isFetching}
      onLoadMore={setCursor}
      onRetry={refetch}
      emptyText="Пока здесь ничего нет."
    />
  );
}
