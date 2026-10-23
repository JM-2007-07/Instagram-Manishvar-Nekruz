'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useGetCollectionsQuery, useGetSavedInfiniteQuery } from '../api';
import { CollectionFormDialog } from './collection-form-dialog';
import { postThumbnail } from './post-grid';
import { SavedEmpty, SavedError, SavedOwnerGate, SavedSkeleton } from './saved-states';

// Карточка подборки как у Instagram: квадрат 302 px, рамка 0.8 px, скругление 4,
// мозаика 2×2, снизу затемнение и название 20/25 белым.
const tileClass =
  'relative block aspect-square overflow-hidden rounded-[4px] border-[0.8px] border-stroke bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring';
const titleClass =
  'absolute inset-x-0 bottom-0 bg-linear-to-t from-black/50 to-transparent px-5 pt-10 pb-[15px] text-20 font-normal text-white';

export function SavedContent({ username }: { username: string }) {
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
      <div className="mt-[30px] mb-4 flex items-center justify-between px-4 md:px-0">
        <p className="text-12 text-muted-foreground">
          Видеть сохранённые материалы можете только вы
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-0.5 rounded-xs text-14 font-medium text-link hover:opacity-70"
        >
          <Plus className="size-4" aria-hidden />
          Новая подборка
        </button>
      </div>

      {posts.length === 0 && collections.data?.length === 0 ? (
        <SavedEmpty
          title="Сохранённое"
          text="Сохраняйте фото и видео, которые хотите посмотреть ещё раз. Их никто не увидит, кроме вас."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-1 px-1 md:flex md:flex-wrap md:justify-center md:gap-[15px] md:px-0 md:[&>li]:w-[302px]">
          <li>
            <Link href={`${base}/all-posts/`} className={tileClass}>
              {/* Обложка 2×2 из последних сохранённых */}
              <span className="grid size-full grid-cols-2">
                {[0, 1, 2, 3].map((i) =>
                  covers[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={covers[i]} alt="" className="size-full object-cover" />
                  ) : (
                    <span key={i} className="bg-muted" />
                  ),
                )}
              </span>
              <span className={titleClass}>Все публикации</span>
            </Link>
          </li>
          {collections.data?.map((collection) => (
            <li key={collection.id}>
              <Link href={`${base}/${collection.id}/`} className={tileClass}>
                {collection.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={collection.coverUrl} alt="" className="size-full object-cover" />
                )}
                <span className={titleClass}>{collection.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CollectionFormDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

// Вкладка «Сохранённое» внутри профиля (как у Instagram): только владелец видит содержимое.
export function SavedTab({ username }: { username: string }) {
  return (
    <SavedOwnerGate username={username}>
      <SavedContent username={username} />
    </SavedOwnerGate>
  );
}
