'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGetCollectionsQuery, useGetSavedInfiniteQuery } from '../api';
import { CollectionFormDialog } from './collection-form-dialog';
import { postThumbnail } from './post-grid';
import { SavedEmpty, SavedError, SavedOwnerGate, SavedSkeleton } from './saved-states';

const tileClass =
  'relative block aspect-square overflow-hidden rounded-lg bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring';

function SavedContent({ username }: { username: string }) {
  const saved = useGetSavedInfiniteQuery();
  const collections = useGetCollectionsQuery();
  const [creating, setCreating] = useState(false);

  if (saved.isLoading || collections.isLoading) return <SavedSkeleton />;
  if (saved.isError || collections.isError) {
    return (
      <SavedError
        onRetry={() => {
          void saved.refetch();
          void collections.refetch();
        }}
      />
    );
  }

  const posts = saved.data?.pages.flatMap((page) => page.items) ?? [];
  const covers = posts
    .slice(0, 4)
    .map(postThumbnail)
    .filter((url): url is string => !!url);
  const base = `/${username}/saved`;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-14 text-muted-foreground">Видно только вам</p>
        <Button variant="link" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Новая подборка
        </Button>
      </div>

      {posts.length === 0 && collections.data?.length === 0 ? (
        <SavedEmpty
          title="Сохранённое"
          text="Сохраняйте фото и видео, которые хотите посмотреть ещё раз. Их никто не увидит, кроме вас."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <li>
            <Link href={`${base}/all-posts/`} className={tileClass}>
              {/* Обложка 2×2 из последних сохранённых */}
              <span className="grid size-full grid-cols-2 gap-px">
                {[0, 1, 2, 3].map((i) =>
                  covers[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={covers[i]} alt="" className="size-full object-cover" />
                  ) : (
                    <span key={i} className="bg-muted" />
                  ),
                )}
              </span>
              <span className="absolute inset-x-0 bottom-0 bg-black/50 px-3 py-2 text-14 font-semibold text-white">
                Все публикации
              </span>
            </Link>
          </li>
          {collections.data?.map((collection) => (
            <li key={collection.id}>
              <Link href={`${base}/${collection.id}/`} className={tileClass}>
                {collection.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={collection.coverUrl} alt="" className="size-full object-cover" />
                )}
                <span className="absolute inset-x-0 bottom-0 bg-black/50 px-3 py-2 text-14 font-semibold text-white">
                  {collection.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CollectionFormDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

export function SavedPage({ username }: { username: string }) {
  return (
    <div className="mx-auto max-w-[935px] px-4 py-6">
      <h1 className="mb-4 text-20 font-semibold">Сохранённое</h1>
      <SavedOwnerGate username={username}>
        <SavedContent username={username} />
      </SavedOwnerGate>
    </div>
  );
}
