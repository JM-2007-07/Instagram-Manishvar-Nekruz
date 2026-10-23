'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getApiError, showApiError } from '@/lib/api/errors';
import {
  useDeleteCollectionMutation,
  useGetCollectionPostsInfiniteQuery,
  useGetCollectionsQuery,
  useRemovePostFromCollectionMutation,
} from '../api';
import { CollectionFormDialog } from './collection-form-dialog';
import { Modal } from './modal';
import { PostGrid } from './post-grid';
import { SavedEmpty, SavedError, SavedOwnerGate, SavedSkeleton } from './saved-states';

function CollectionContent({ username, collectionId }: { username: string; collectionId: string }) {
  const router = useRouter();
  const collections = useGetCollectionsQuery();
  const posts = useGetCollectionPostsInfiniteQuery(collectionId);
  const [removePost] = useRemovePostFromCollectionMutation();
  const [deleteCollection, { isLoading: isDeleting }] = useDeleteCollectionMutation();
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (collections.isLoading || posts.isLoading) return <SavedSkeleton />;
  // 404 — подборки нет или она чужая
  if (posts.isError && getApiError(posts.error).status === 404) {
    return <SavedEmpty title="Подборка не найдена" text="Возможно, она была удалена." />;
  }
  if (posts.isError || collections.isError) {
    return (
      <SavedError
        onRetry={() => {
          void posts.refetch();
          void collections.refetch();
        }}
      />
    );
  }

  const collection = collections.data?.find((item) => item.id === collectionId);
  const items = posts.data?.pages.flatMap((page) => page.items) ?? [];

  async function confirmDelete() {
    try {
      await deleteCollection(collectionId).unwrap();
      router.push(`/${username}/saved/`);
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-20 font-semibold">{collection?.name ?? 'Подборка'}</h1>
        {collection && (
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={() => setRenaming(true)}>
              <Pencil className="size-4" />
              Изменить
            </Button>
            <Button variant="secondary" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="size-4" />
              Удалить
            </Button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <SavedEmpty
          title="В подборке пока пусто"
          text="Добавляйте сюда сохранённые публикации через закладку под публикацией."
        />
      ) : (
        <PostGrid
          posts={items}
          removeLabel="Убрать из подборки"
          onRemove={(post) =>
            removePost({ collectionId, postId: post.id })
              .unwrap()
              .catch((error) => showApiError(error))
          }
          hasNextPage={posts.hasNextPage}
          isFetchingNextPage={posts.isFetchingNextPage}
          fetchNextPage={posts.fetchNextPage}
        />
      )}

      {collection && (
        <CollectionFormDialog open={renaming} onOpenChange={setRenaming} collection={collection} />
      )}
      <Modal open={confirmingDelete} onOpenChange={setConfirmingDelete} title="Удалить подборку?">
        <p className="px-4 pt-4 text-14 text-muted-foreground">
          Публикации останутся в разделе «Сохранённое».
        </p>
        <div className="flex flex-col p-4">
          <Button variant="destructive" disabled={isDeleting} onClick={() => void confirmDelete()}>
            Удалить
          </Button>
          <Button variant="ghost" className="mt-2" onClick={() => setConfirmingDelete(false)}>
            Отмена
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function CollectionPage({
  username,
  collectionId,
}: {
  username: string;
  collectionId: string;
}) {
  return (
    <div className="mx-auto max-w-[935px] px-4 py-6">
      <Link
        href={`/${username}/saved/`}
        aria-label="Назад к сохранённому"
        className="mb-3 inline-block"
      >
        <ArrowLeft className="size-6" />
      </Link>
      <SavedOwnerGate username={username}>
        <CollectionContent username={username} collectionId={collectionId} />
      </SavedOwnerGate>
    </div>
  );
}
