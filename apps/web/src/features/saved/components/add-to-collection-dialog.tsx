'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { showApiError } from '@/lib/api/errors';
import {
  useAddPostToCollectionMutation,
  useCreateCollectionMutation,
  useGetCollectionsQuery,
} from '../api';
import { Modal } from './modal';

// «Добавить в подборку»: выбрать существующую или создать новую с этим постом.
export function AddToCollectionDialog({
  postId,
  open,
  onOpenChange,
}: {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // skip: список нужен только в открытом окне
  const {
    data: collections,
    isLoading,
    isError,
    refetch,
  } = useGetCollectionsQuery(undefined, {
    skip: !open,
  });
  const [addPost, { isLoading: isAdding }] = useAddPostToCollectionMutation();
  const [createCollection, { isLoading: isCreating }] = useCreateCollectionMutation();
  const [name, setName] = useState('');

  async function add(collectionId: string, collectionName: string) {
    try {
      await addPost({ collectionId, postId }).unwrap();
      toast(`Добавлено в «${collectionName}»`);
      onOpenChange(false);
    } catch (error) {
      showApiError(error);
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createCollection({ name: trimmed, postIds: [postId] }).unwrap();
      setName('');
      toast(`Подборка «${trimmed}» создана`);
      onOpenChange(false);
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Сохранить в подборку">
      <div className="flex flex-col py-2">
        {isLoading && <div className="mx-4 my-2 h-12 animate-pulse rounded-lg bg-muted" />}
        {isError && (
          <div role="alert" className="flex flex-col items-center gap-2 p-4">
            <p className="text-14 text-muted-foreground">Не удалось загрузить подборки</p>
            <Button onClick={() => void refetch()}>Повторить</Button>
          </div>
        )}
        {collections?.map((collection) => (
          <button
            key={collection.id}
            type="button"
            disabled={isAdding}
            onClick={() => void add(collection.id, collection.name)}
            className="flex items-center gap-3 px-4 py-2 text-left hover:bg-hover-overlay disabled:opacity-50"
          >
            {collection.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={collection.coverUrl} alt="" className="size-12 rounded-lg object-cover" />
            ) : (
              <span className="size-12 rounded-lg bg-muted" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-14 font-semibold">{collection.name}</span>
              <span className="block text-12 text-muted-foreground">
                Публикаций: {collection.postCount}
              </span>
            </span>
          </button>
        ))}
        {collections?.length === 0 && (
          <p className="px-4 py-2 text-14 text-muted-foreground">Подборок пока нет.</p>
        )}
      </div>
      <form
        onSubmit={(e) => void create(e)}
        className="flex items-end gap-2 border-t border-border p-4"
      >
        <label className="flex-1 text-12 text-muted-foreground">
          Новая подборка
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder="Название подборки"
            className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-14 text-foreground outline-none focus:border-[var(--input-border-focus)]"
          />
        </label>
        <Button type="submit" disabled={isCreating || !name.trim()} aria-label="Создать подборку">
          <Plus className="size-4" />
          Создать
        </Button>
      </form>
    </Modal>
  );
}
