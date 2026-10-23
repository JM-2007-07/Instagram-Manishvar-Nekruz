'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { UserAvatar } from '@/components/temp/student-a';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGetStoryViewersQuery } from '../api';

/** Подтверждение опасного действия (удалить историю / актуальное). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[400px]" showClose={false} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end gap-2 p-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
                onOpenChange(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Переименование актуального. */
export function RenameDialog({
  open,
  onOpenChange,
  initialTitle,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTitle: string;
  onSave: (title: string) => Promise<void> | void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[400px]" showClose={false} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Изменить актуальное</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            setBusy(true);
            try {
              await onSave(title.trim());
            } finally {
              setBusy(false);
              onOpenChange(false);
            }
          }}
        >
          <input
            aria-label="Название"
            value={title}
            maxLength={30}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 rounded-xl border border-border bg-transparent px-4 text-14 outline-none"
          />
          <Button type="submit" disabled={busy || !title.trim()}>
            Готово
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Список просмотревших свою историю (F-STR-11). */
export function ViewersDialog({
  storyId,
  open,
  onOpenChange,
}: {
  storyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, isError, refetch } = useGetStoryViewersQuery(storyId, { skip: !open });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[400px]" showClose={false} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Просмотры</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {isLoading && <p className="p-4 text-14 text-muted-foreground">Загрузка…</p>}
          {isError && (
            <div className="flex flex-col items-center gap-2 p-4">
              <p className="text-14 text-muted-foreground">Не удалось загрузить просмотры</p>
              <Button onClick={() => refetch()}>Повторить</Button>
            </div>
          )}
          {data && data.items.length === 0 && (
            <p className="p-4 text-center text-14 text-muted-foreground">Пока нет просмотров</p>
          )}
          {data?.items.map((viewer) => (
            <div key={viewer.id} className="flex items-center gap-3 px-2 py-2">
              <UserAvatar user={viewer} size={44} ring={false} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-14 font-semibold">{viewer.userName}</p>
                <p className="truncate text-14 text-muted-foreground">{viewer.fullName}</p>
              </div>
              {viewer.reaction && <span aria-label="Реакция">{viewer.reaction}</span>}
              {viewer.liked && <Heart aria-label="Лайк" className="size-5 fill-badge text-badge" />}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
