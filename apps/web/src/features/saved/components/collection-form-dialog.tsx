'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showApiError } from '@/lib/api/errors';
import type { Collection } from '@/lib/api/types';
import {
  useCreateCollectionMutation,
  useGetSavedInfiniteQuery,
  useUpdateCollectionMutation,
} from '../api';
import { Modal } from './modal';
import { postThumbnail } from './post-grid';

const inputClass =
  'mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-14 text-foreground outline-none focus:border-[var(--input-border-focus)]';

// Создание подборки: название + выбор постов из сохранённых.
function CreateForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const { data, isLoading, hasNextPage, fetchNextPage } = useGetSavedInfiniteQuery();
  const [createCollection, { isLoading: isSaving }] = useCreateCollectionMutation();
  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  function toggle(postId: string) {
    setSelected((current) =>
      current.includes(postId) ? current.filter((id) => id !== postId) : [...current, postId],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await createCollection({ name: name.trim(), postIds: selected }).unwrap();
      onDone();
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 p-4">
      <label className="text-12 text-muted-foreground">
        Название подборки
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          required
          className={inputClass}
        />
      </label>
      <p className="text-14 font-semibold">Выберите публикации</p>
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      ) : posts.length === 0 ? (
        <p className="text-14 text-muted-foreground">Сохранённых публикаций пока нет.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-1">
          {posts.map((post) => {
            const thumb = postThumbnail(post);
            const isSelected = selected.includes(post.id);
            return (
              <li key={post.id} className="relative aspect-square bg-muted">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Выбрать публикацию ${post.author.userName}`}
                  onClick={() => toggle(post.id)}
                  className="size-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="size-full object-cover" />
                  )}
                  {isSelected && (
                    <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {hasNextPage && (
        <Button type="button" variant="secondary" onClick={() => void fetchNextPage()}>
          Показать ещё
        </Button>
      )}
      <Button type="submit" disabled={isSaving || !name.trim()}>
        Создать
      </Button>
    </form>
  );
}

function RenameForm({ collection, onDone }: { collection: Collection; onDone: () => void }) {
  const [name, setName] = useState(collection.name);
  const [updateCollection, { isLoading }] = useUpdateCollectionMutation();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await updateCollection({ collectionId: collection.id, name: name.trim() }).unwrap();
      onDone();
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 p-4">
      <label className="text-12 text-muted-foreground">
        Название подборки
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          required
          className={inputClass}
        />
      </label>
      <Button type="submit" disabled={isLoading || !name.trim()}>
        Сохранить
      </Button>
    </form>
  );
}

// Форма монтируется только при открытии окна — поля всегда начинаются с чистого состояния.
export function CollectionFormDialog({
  open,
  onOpenChange,
  collection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Передана — переименование, иначе создание. */
  collection?: Collection;
}) {
  const close = () => onOpenChange(false);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={collection ? 'Изменить подборку' : 'Новая подборка'}
    >
      {collection ? (
        <RenameForm collection={collection} onDone={close} />
      ) : (
        <CreateForm onDone={close} />
      )}
    </Modal>
  );
}
