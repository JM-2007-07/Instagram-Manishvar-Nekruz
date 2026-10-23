'use client';

import { useState } from 'react';
import { Hash } from 'lucide-react';
import { getApiError } from '@/lib/api/errors';
import { useGetHashtagPostsQuery, useGetHashtagQuery } from '../api';
import { NotAvailable } from './not-available';
import { PostGrid } from './post-grid';

// Страница хэштега /explore/tags/{tag}/ (F-SRC-04).
export function HashtagPage({ tag }: { tag: string }) {
  const name = tag.toLowerCase();
  const [cursor, setCursor] = useState<string | null>(null);
  const info = useGetHashtagQuery(name);
  const posts = useGetHashtagPostsQuery({ name, cursor });

  if (info.error && getApiError(info.error).status === 404) return <NotAvailable />;
  const preview = posts.data?.items[0]?.items[0]?.media;
  const previewUrl = preview?.kind === 'VIDEO' ? preview.thumbnailUrl : preview?.url;

  return (
    <div className="mx-auto w-full max-w-[935px] px-4 py-6 md:px-5 md:py-8">
      <header className="mb-6 flex items-center gap-4 md:mb-11 md:gap-[30px]">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-stroke bg-background-secondary md:size-[152px]">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={`Превью #${name}`} className="size-full object-cover" />
          ) : (
            <Hash className="size-10 text-icon-secondary md:size-16" aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold md:text-[28px]">#{name}</h1>
          {info.data && (
            <p className="mt-2 text-base">
              <span className="font-semibold">{info.data.postCount}</span> публикаций
            </p>
          )}
        </div>
      </header>
      <h2 className="mb-3 text-14 font-semibold text-muted-foreground">Популярные публикации</h2>
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
