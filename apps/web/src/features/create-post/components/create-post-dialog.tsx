'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Crop, Images, Plus, X, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getApiError, getErrorText } from '@/lib/api/errors';
import { uploadMedia } from '@/lib/api/upload';
import { useCreatePostMutation } from '../api';
import { ASPECTS, MAX_FILES, type Aspect, type DraftItem, type DraftTag } from '../types';
import { CaptionPanel, type CaptionState } from './caption-panel';
import { MediaPreview } from './media-preview';

type Step = 'select' | 'crop' | 'caption' | 'sending' | 'done' | 'error';

const headerButton =
  'absolute top-0 flex h-[42px] items-center px-4 text-14 outline-none focus-visible:ring-2 focus-visible:ring-ring';

// Окно «Создать публикацию»: выбор → обрезка → подпись → отправка (CreatePostDialog).
export function CreatePostDialog({ onClose }: { onClose: () => void }) {
  const [createPost] = useCreatePostMutation();
  const [step, setStep] = useState<Step>('select');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [index, setIndex] = useState(0);
  const [aspect, setAspect] = useState<Aspect>('1:1');
  const [panel, setPanel] = useState<null | 'aspect' | 'zoom' | 'gallery'>(null);
  const [form, setForm] = useState<CaptionState>({
    caption: '',
    location: null,
    hideLikeCount: false,
    commentsDisabled: false,
  });
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<null | 'close' | 'back'>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Освобождаем objectURL при закрытии окна.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const current = items[index];

  function addFiles(list: FileList | File[]) {
    const accepted = Array.from(list).filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
    );
    const free = MAX_FILES - items.length;
    if (accepted.length > free)
      toast.error(`В публикации может быть не больше ${MAX_FILES} файлов`);
    const added: DraftItem[] = accepted.slice(0, free).map((file) => ({
      key: `${file.name}-${file.size}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
      isVideo: file.type.startsWith('video/'),
      zoom: 1,
      offset: { x: 0, y: 0 },
      altText: '',
      tags: [],
    }));
    if (added.length === 0) return;
    setItems([...items, ...added]);
    if (step === 'select') setStep('crop');
  }

  function patchItem(i: number, patch: Partial<DraftItem>) {
    setItems((list) => list.map((it, n) => (n === i ? { ...it, ...patch } : it)));
  }

  function removeItem(i: number) {
    URL.revokeObjectURL(items[i].url);
    const rest = items.filter((_, n) => n !== i);
    setItems(rest);
    setIndex(Math.max(0, Math.min(index, rest.length - 1)));
    if (rest.length === 0) setStep('select');
  }

  // Закрытие: если есть файлы и публикация не отправлена — спрашиваем.
  function requestClose() {
    if (step === 'sending') return;
    if (items.length > 0 && step !== 'done') setConfirm('close');
    else onClose();
  }

  function discard() {
    if (confirm === 'close') return onClose();
    items.forEach((i) => URL.revokeObjectURL(i.url));
    setItems([]);
    setIndex(0);
    setConfirm(null);
    setStep('select');
  }

  // Видео одно — Reels, иначе обычная публикация.
  const isReel = items.length === 1 && items[0].isVideo;

  async function publish() {
    setStep('sending');
    setError('');
    setProgress(0);
    try {
      const ids: string[] = [];
      for (let i = 0; i < items.length; i++) {
        let mediaId = items[i].mediaId;
        if (!mediaId) {
          const media = await uploadMedia(items[i].file, isReel ? 'REEL' : 'POST', (p) =>
            setProgress(Math.min(99, Math.round(((i + p / 100) / items.length) * 100))),
          );
          mediaId = media.id;
          patchItem(i, { mediaId }); // «Повторить» не загружает файл заново
        }
        ids.push(mediaId);
      }
      await createPost({
        type: isReel ? 'REEL' : 'POST',
        items: items.map((it, i) => ({
          mediaId: ids[i],
          altText: it.altText || undefined,
          tags: it.tags.length ? it.tags.map(({ userId, x, y }) => ({ userId, x, y })) : undefined,
        })),
        caption: form.caption || undefined,
        locationId: form.location?.id,
        hideLikeCount: form.hideLikeCount,
        commentsDisabled: form.commentsDisabled,
        cropAspect: aspect === 'original' ? undefined : aspect,
      }).unwrap();
      setProgress(100);
      setStep('done');
    } catch (e) {
      setError(getErrorText(getApiError(e).code));
      setStep('error');
    }
  }

  const titles: Record<Step, string> = {
    select: 'Создание публикации',
    crop: 'Обрезать',
    caption: 'Создание публикации',
    sending: 'Публикация отправляется',
    done: 'Публикация опубликована',
    error: 'Не удалось опубликовать',
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && requestClose()}>
        <DialogContent
          aria-describedby={undefined}
          className={`[--s:min(calc(100vw-32px),calc(100dvh-100px),855px)] w-[var(--s)] ${
            step === 'caption' ? 'md:w-[calc(var(--s)+340px)]' : ''
          } overflow-y-auto`}
        >
          <DialogHeader className="relative shrink-0">
            {(step === 'crop' || step === 'caption') && (
              <button
                type="button"
                aria-label="Назад"
                className={`${headerButton} left-0`}
                onClick={() => (step === 'crop' ? setConfirm('back') : setStep('crop'))}
              >
                <ArrowLeft className="size-5" />
              </button>
            )}
            <DialogTitle className="text-16 font-semibold">{titles[step]}</DialogTitle>
            {step === 'crop' && (
              <button
                type="button"
                className={`${headerButton} right-0 font-semibold text-button-borderless hover:text-button-borderless-hover`}
                onClick={() => setStep('caption')}
              >
                Далее
              </button>
            )}
            {step === 'caption' && (
              <button
                type="button"
                className={`${headerButton} right-0 font-semibold text-button-borderless hover:text-button-borderless-hover`}
                onClick={publish}
              >
                Поделиться
              </button>
            )}
          </DialogHeader>

          {step === 'select' && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
              className={`flex aspect-square w-full flex-col items-center justify-center gap-4 ${
                dragOver ? 'bg-background-highlight' : ''
              }`}
            >
              <Images className="size-20 text-foreground" strokeWidth={1} aria-hidden />
              <p className="text-20 font-light">Перетащите сюда фото и видео</p>
              <Button onClick={() => inputRef.current?.click()}>Выбрать на компьютере</Button>
            </div>
          )}

          {step === 'crop' && current && (
            <div className="relative">
              <MediaPreview
                items={items}
                index={index}
                aspect={aspect}
                onIndex={setIndex}
                onMove={(offset) => patchItem(index, { offset })}
              />
              <div className="absolute bottom-3 left-3 flex flex-col items-start gap-2">
                {panel === 'aspect' && (
                  <ul className="w-28 overflow-hidden rounded-lg bg-overlay text-14 text-white">
                    {ASPECTS.map((a) => (
                      <li key={a.value}>
                        <button
                          type="button"
                          className={`w-full px-4 py-2 text-left ${aspect === a.value ? 'font-semibold' : ''}`}
                          onClick={() => {
                            setAspect(a.value);
                            setPanel(null);
                          }}
                        >
                          {a.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {panel === 'zoom' && (
                  <input
                    type="range"
                    aria-label="Масштаб"
                    min={1}
                    max={3}
                    step={0.01}
                    value={current.zoom}
                    onChange={(e) => patchItem(index, { zoom: Number(e.target.value) })}
                    className="w-28 accent-primary"
                  />
                )}
                <div className="flex gap-2">
                  <RoundButton
                    label="Формат"
                    onClick={() => setPanel(panel === 'aspect' ? null : 'aspect')}
                  >
                    <Crop className="size-4" />
                  </RoundButton>
                  <RoundButton
                    label="Масштаб"
                    onClick={() => setPanel(panel === 'zoom' ? null : 'zoom')}
                  >
                    <ZoomIn className="size-4" />
                  </RoundButton>
                </div>
              </div>
              <div className="absolute right-3 bottom-3 flex flex-col items-end gap-2">
                {panel === 'gallery' && (
                  <div className="flex max-w-[calc(var(--s)-24px)] gap-2 overflow-x-auto rounded-lg bg-overlay p-2">
                    {items.map((it, i) => (
                      <div key={it.key} className="relative shrink-0">
                        <button
                          type="button"
                          aria-label={`Файл ${i + 1}`}
                          onClick={() => setIndex(i)}
                          className={`block size-[94px] overflow-hidden rounded ${i === index ? 'ring-2 ring-white' : ''}`}
                        >
                          {it.isVideo ? (
                            <video src={it.url} className="size-full object-cover" muted />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.url} alt="" className="size-full object-cover" />
                          )}
                        </button>
                        <button
                          type="button"
                          aria-label={`Удалить файл ${i + 1}`}
                          onClick={() => removeItem(i)}
                          className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-overlay text-white"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                    {items.length < MAX_FILES && (
                      <button
                        type="button"
                        aria-label="Добавить ещё"
                        onClick={() => inputRef.current?.click()}
                        className="flex size-[94px] shrink-0 items-center justify-center rounded border border-white/40 text-white"
                      >
                        <Plus className="size-6" />
                      </button>
                    )}
                  </div>
                )}
                <RoundButton
                  label="Галерея"
                  onClick={() => setPanel(panel === 'gallery' ? null : 'gallery')}
                >
                  <Images className="size-4" />
                </RoundButton>
              </div>
            </div>
          )}

          {step === 'caption' && current && (
            <div className="grid min-h-0 md:grid-cols-[minmax(0,1fr)_340px]">
              <MediaPreview items={items} index={index} aspect={aspect} onIndex={setIndex} />
              <div className="border-border md:border-l">
                <CaptionPanel
                  state={form}
                  onState={setForm}
                  items={items}
                  index={index}
                  onAlt={(i, altText) => patchItem(i, { altText })}
                  onTags={(i, tags: DraftTag[]) => patchItem(i, { tags })}
                />
              </div>
            </div>
          )}

          {(step === 'sending' || step === 'done' || step === 'error') && (
            <div
              className={`flex aspect-square w-full flex-col items-center justify-center gap-4 px-6 text-center`}
            >
              {step === 'sending' && <ProgressRing percent={progress} />}
              {step === 'done' && (
                <>
                  <span className="flex size-24 items-center justify-center rounded-full border-2 border-success text-success">
                    <Check className="size-12" />
                  </span>
                  <p className="text-20 font-light">Ваша публикация опубликована</p>
                  <Button onClick={onClose}>Готово</Button>
                </>
              )}
              {step === 'error' && (
                <>
                  <p role="alert" className="text-16">
                    {error}
                  </p>
                  <Button onClick={publish}>Повторить</Button>
                </>
              )}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            aria-label="Выбрать файлы"
            tabIndex={-1}
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </DialogContent>
      </Dialog>

      {confirm && (
        <Dialog open onOpenChange={(open) => !open && setConfirm(null)}>
          <DialogContent
            showClose={false}
            aria-describedby={undefined}
            className="w-[400px] rounded-xl"
          >
            <div className="px-8 pt-8 pb-5 text-center">
              <DialogTitle className="text-20 font-normal">Удалить публикацию?</DialogTitle>
              <p className="pt-1 text-14 text-muted-foreground">
                Если вы выйдете, изменения не будут сохранены.
              </p>
            </div>
            <button
              type="button"
              onClick={discard}
              className="block w-full border-t border-border py-3 text-14 font-bold text-destructive"
            >
              Удалить
            </button>
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="block w-full border-t border-border py-3 text-14"
            >
              Отмена
            </button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function RoundButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-full bg-overlay text-white"
    >
      {children}
    </button>
  );
}

// Круг-прогресс загрузки.
function ProgressRing({ percent }: { percent: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Публикация отправляется"
      className="relative size-24"
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="4" className="stroke-secondary" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
          className="stroke-primary transition-[stroke-dashoffset]"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-14">{percent}%</span>
    </div>
  );
}
