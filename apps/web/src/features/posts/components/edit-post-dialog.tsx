'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { UserAvatar } from '@/features/users/components/user-avatar';
import { showApiError } from '@/lib/api/errors';
import { useUpdatePostMutation } from '../api';
import type { Post } from '../types';

const MAX_CAPTION = 2200; // как MAX_CAPTION_LENGTH в API

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-14">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-secondary'}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </button>
    </div>
  );
}

/**
 * «Редактировать» в меню своей публикации (как в Instagram): «Отмена» · «Редактировать информацию» · «Готово»,
 * слева фото, справа подпись и настройки. Сохраняет только изменённые поля (PATCH /posts/{id}).
 */
export function EditPostDialog({
  post,
  open,
  onOpenChange,
}: {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [caption, setCaption] = useState(post.caption ?? '');
  const [hideLikeCount, setHideLikeCount] = useState(post.hideLikeCount);
  const [commentsDisabled, setCommentsDisabled] = useState(post.commentsDisabled);
  const [updatePost, { isLoading }] = useUpdatePostMutation();
  const cover = post.items[0]?.media;

  function reset(next: boolean) {
    if (next) {
      setCaption(post.caption ?? '');
      setHideLikeCount(post.hideLikeCount);
      setCommentsDisabled(post.commentsDisabled);
    }
    onOpenChange(next);
  }

  async function save() {
    const patch: { caption?: string; hideLikeCount?: boolean; commentsDisabled?: boolean } = {};
    if (caption !== (post.caption ?? '')) patch.caption = caption;
    if (hideLikeCount !== post.hideLikeCount) patch.hideLikeCount = hideLikeCount;
    if (commentsDisabled !== post.commentsDisabled) patch.commentsDisabled = commentsDisabled;
    if (Object.keys(patch).length === 0) return onOpenChange(false);
    try {
      await updatePost({ postId: post.id, patch }).unwrap();
      toast('Публикация изменена');
      onOpenChange(false);
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent
        showClose={false}
        className="flex max-h-[calc(100dvh-40px)] w-[min(900px,calc(100vw-32px))] flex-col overflow-hidden p-0"
      >
        <div className="flex h-[43px] shrink-0 items-center justify-between border-b border-border px-4">
          <button type="button" className="text-14" onClick={() => reset(false)}>
            Отмена
          </button>
          <DialogTitle className="text-16 font-semibold">Редактировать информацию</DialogTitle>
          <button
            type="button"
            disabled={isLoading || caption.length > MAX_CAPTION}
            onClick={save}
            className="text-14 font-semibold text-primary hover:text-link disabled:opacity-50"
          >
            Готово
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {cover && (
            <div className="hidden aspect-square bg-black md:block md:w-[60%]">
              {cover.kind === 'VIDEO' ? (
                <video src={cover.url} className="size-full object-contain" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover.url} alt="" className="size-full object-contain" />
              )}
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              <UserAvatar user={post.author} size={28} ring={false} />
              <span className="text-14 font-semibold">{post.author.userName}</span>
            </div>
            <textarea
              aria-label="Подпись"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Добавьте подпись…"
              rows={7}
              className="resize-none bg-transparent px-4 text-16 outline-none md:text-14"
              autoFocus
            />
            <div
              className={`px-4 pb-3 text-right text-12 ${caption.length > MAX_CAPTION ? 'text-destructive' : 'text-text-tertiary'}`}
            >
              {caption.length}/{MAX_CAPTION.toLocaleString('ru-RU')}
            </div>
            <div className="border-t border-border">
              <Toggle
                label="Скрыть число отметок «Нравится»"
                checked={hideLikeCount}
                onChange={setHideLikeCount}
              />
              <Toggle
                label="Отключить комментирование"
                checked={commentsDisabled}
                onChange={setCommentsDisabled}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
