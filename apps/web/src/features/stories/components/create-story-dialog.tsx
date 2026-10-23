'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getApiError } from '@/lib/api/errors';
import { uploadMedia } from '@/lib/api/upload';
import { cn } from '@/lib/utils';
import { useCreateStoryMutation } from '../api';
import type { MediaItem } from '../types';

type Audience = 'EVERYONE' | 'CLOSE_FRIENDS';

/** Создание истории: файл → превью 9:16 → аудитория → «Поделиться» (F-STR-02). */
export function CreateStoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [audience, setAudience] = useState<Audience>('EVERYONE');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [createStory] = useCreateStoryMutation();
  const busy = progress !== null;

  // Освобождаем blob-адрес превью.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function reset() {
    setFile(null);
    setPreviewUrl(null);
    setAudience('EVERYONE');
    setProgress(null);
    setError(null);
  }

  function pick(selected: File | undefined) {
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setError(null);
  }

  async function publish() {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const media = (await uploadMedia(file, 'STORY', setProgress)) as MediaItem;
      await createStory({ mediaId: media.id, audience }).unwrap();
      toast.success('Ваша история опубликована');
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(getApiError(e).message || 'Не удалось опубликовать историю');
      setProgress(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="w-[420px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Новая история</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 p-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            aria-label="Выбрать фото или видео"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          {previewUrl && file ? (
            <div className="relative aspect-[9/16] max-h-[60vh] overflow-hidden rounded-lg bg-media-backdrop">
              {file.type.startsWith('video/') ? (
                <video src={previewUrl} className="size-full object-cover" muted loop autoPlay />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Предпросмотр истории"
                  className="size-full object-cover"
                />
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-[9/16] max-h-[60vh] flex-col items-center justify-center gap-3 rounded-lg bg-background-secondary px-8 text-16 text-icon-secondary"
            >
              <ImagePlus className="size-12" />
              Выбрать фото или видео
            </button>
          )}

          {file && (
            <div role="radiogroup" aria-label="Аудитория" className="flex w-full gap-2">
              {(
                [
                  ['EVERYONE', 'Ваша история'],
                  ['CLOSE_FRIENDS', 'Близкие друзья'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={audience === value}
                  onClick={() => setAudience(value)}
                  className={cn(
                    'h-8 flex-1 rounded-lg text-14 font-semibold',
                    audience === value
                      ? value === 'CLOSE_FRIENDS'
                        ? 'bg-close-friends text-white'
                        : 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {busy && <p className="text-14 text-muted-foreground">Загрузка… {progress}%</p>}
          {error && (
            <p role="alert" className="text-14 text-destructive">
              {error}
            </p>
          )}

          {file && (
            <div className="flex w-full justify-between gap-2">
              <Button variant="ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
                Другой файл
              </Button>
              <Button disabled={busy} onClick={publish}>
                {error ? 'Повторить' : 'Поделиться'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
