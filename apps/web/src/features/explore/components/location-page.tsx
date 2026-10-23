'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { getApiError } from '@/lib/api/errors';
import { useGetLocationPostsQuery, useGetLocationQuery } from '../api';
import { NotAvailable } from './not-available';
import { PostGrid } from './post-grid';

// Страница места /explore/locations/{id}/ (F-SRC-05).
export function LocationPage({ id }: { id: string }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const info = useGetLocationQuery(id);
  const posts = useGetLocationPostsQuery({ id, cursor });

  if (info.error && getApiError(info.error).status === 404) return <NotAvailable />;
  const place = info.data;
  const address = place ? [place.city, place.state, place.country].filter(Boolean).join(', ') : '';

  return (
    <div className="mx-auto w-full max-w-[935px] px-4 py-6 md:px-5 md:py-8">
      <header className="mb-6 flex items-center gap-4 md:mb-11 md:gap-[30px]">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-full border border-stroke bg-background-secondary md:size-[152px]">
          <MapPin className="size-10 text-icon-secondary md:size-16" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold md:text-[28px]">{place?.name ?? ''}</h1>
          {address && <p className="mt-1 text-14 text-muted-foreground">{address}</p>}
          {place && (
            <p className="mt-2 text-base">
              <span className="font-semibold">{place.postCount}</span> публикаций
            </p>
          )}
        </div>
      </header>
      <PostGrid
        posts={posts.data?.items}
        isLoading={posts.isLoading}
        isError={posts.isError}
        nextCursor={posts.data?.nextCursor}
        isFetching={posts.isFetching}
        onLoadMore={setCursor}
        onRetry={posts.refetch}
      />
    </div>
  );
}
