'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { useCreateHighlightMutation, useGetArchivedStoriesQuery } from '../api';

/** Новое актуальное: выбор историй из архива, название; обложка — первая выбранная (F-STR-20). */
export function CreateHighlightDialog({
  open,
  onOpenChange,
  initialStoryIds = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStoryIds?: string[];
}) {
  const [cursor, setCursor] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useGetArchivedStoriesQuery(
    { cursor },
    { skip: !open },
  );
  const [selected, setSelected] = useState<string[]>(initialStoryIds);
  const [title, setTitle] = useState('Актуальное');
  const [createHighlight, { isLoading: saving }] = useCreateHighlightMutation();

  function toggle(id: string) {
    setSelected((list) => (list.includes(id) ? list.filter((s) => s !== id) : [...list, id]));
  }

  async function save() {
    try {
      await createHighlight({ title: title.trim(), storyIds: selected }).unwrap();
      toast.success('Актуальное создано');
      onOpenChange(false);
    } catch (e) {
      toast.error(getApiError(e).message || 'Не удалось создать актуальное');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[480px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Новое актуальное</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 p-4">
          <input
            aria-label="Название"
            value={title}
            maxLength={30}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 rounded-xl border border-border bg-transparent px-4 text-14 outline-none"
          />

          {isLoading && <p className="text-14 text-muted-foreground">Загрузка архива…</p>}
          {isError && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-14 text-muted-foreground">Не удалось загрузить архив</p>
              <Button onClick={() => refetch()}>Повторить</Button>
            </div>
          )}
          {data && data.items.length === 0 && (
            <p className="text-center text-14 text-muted-foreground">В архиве пока нет историй</p>
          )}

          <ul className="grid max-h-[50vh] grid-cols-3 gap-1 overflow-y-auto">
            {data?.items.map((story) => {
              const isSelected = selected.includes(story.id);
              return (
                <li key={story.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`История от ${new Date(story.createdAt).toLocaleDateString('ru-RU')}`}
                    onClick={() => toggle(story.id)}
                    className="relative block aspect-[9/16] w-full overflow-hidden bg-background-secondary"
                  >
                    {story.media && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={story.media.thumbnailUrl ?? story.media.url}
                        alt=""
                        className="size-full object-cover"
                      />
                    )}
                    <span
                      className={cn(
                        'absolute top-1 right-1 flex size-5 items-center justify-center rounded-full border-2 border-white',
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-black/20',
                      )}
                    >
                      {isSelected && <Check className="size-3" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {data?.nextCursor && (
            <Button variant="ghost" onClick={() => setCursor(data.nextCursor)}>
              Показать ещё
            </Button>
          )}

          <Button disabled={saving || selected.length === 0 || !title.trim()} onClick={save}>
            Добавить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
