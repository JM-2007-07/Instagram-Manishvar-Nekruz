'use client';

import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import { showApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { useSavePostMutation } from '../api';
import { AddToCollectionDialog } from './add-to-collection-dialog';

// Кнопка-закладка карточки поста. Вид меняется сразу, при ошибке возвращается (F-INT-09).
// После сохранения тост предлагает «Добавить в подборку» (как в Instagram).
export function SaveButton({
  postId,
  isSavedByMe,
  className,
}: {
  postId: string;
  isSavedByMe: boolean;
  className?: string;
}) {
  const [savePost, { isLoading }] = useSavePostMutation();
  // optimistic — выбор пользователя до ответа; сбрасывается, когда с сервера пришло новое значение.
  const [optimistic, setOptimistic] = useState<{ base: boolean; value: boolean } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const saved = optimistic && optimistic.base === isSavedByMe ? optimistic.value : isSavedByMe;

  async function toggle() {
    const next = !saved;
    setOptimistic({ base: isSavedByMe, value: next });
    try {
      await savePost({ postId, saved: next }).unwrap();
      if (next) {
        toast('Сохранено', {
          action: { label: 'Добавить в подборку', onClick: () => setPickerOpen(true) },
        });
      }
    } catch (error) {
      setOptimistic(null); // откат
      showApiError(error);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={saved ? 'Удалить из сохранённого' : 'Сохранить'}
        aria-pressed={saved}
        disabled={isLoading}
        onClick={() => void toggle()}
        className={cn(
          'rounded-lg p-2 outline-none hover:opacity-60 focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <Bookmark className={cn('size-6', saved && 'fill-current')} />
      </button>
      <AddToCollectionDialog postId={postId} open={pickerOpen} onOpenChange={setPickerOpen} />
    </>
  );
}
