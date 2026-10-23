'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { showApiError } from '@/lib/api/errors';
import { useDeletePostMutation, useGetCurrentUserQuery } from '../api';
import type { Post } from '../types';
import { copyPostLink } from './post-actions';
import { EditPostDialog } from './edit-post-dialog';

// Меню «…»: для своего поста «Удалить» (с подтверждением) и «Редактировать», для всех — «Перейти к публикации», «Копировать ссылку».
export function PostMenu({ post, onDeleted }: { post: Post; onDeleted?: () => void }) {
  const { data: me } = useGetCurrentUserQuery();
  const [deletePost, { isLoading }] = useDeletePostMutation();
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const isMine = me?.id === post.author.id;

  async function remove() {
    try {
      await deletePost(post.id).unwrap();
      setConfirm(false);
      toast('Публикация удалена');
      onDeleted?.();
    } catch (error) {
      showApiError(error);
    }
  }

  const rowClass = 'justify-center border-b border-border last:border-b-0 rounded-none';
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Ещё"
          className="flex size-10 items-center justify-center hover:opacity-50"
        >
          <MoreHorizontal className="size-6" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[400px] max-w-[calc(100vw-32px)] p-0">
          {isMine && (
            <DropdownMenuItem
              className={`${rowClass} font-bold text-destructive`}
              onSelect={() => setConfirm(true)}
            >
              Удалить
            </DropdownMenuItem>
          )}
          {isMine && (
            <DropdownMenuItem className={rowClass} onSelect={() => setEditing(true)}>
              Редактировать
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild className={rowClass}>
            <Link href={`/p/${post.shortcode}/`}>Перейти к публикации</Link>
          </DropdownMenuItem>
          <DropdownMenuItem className={rowClass} onSelect={() => copyPostLink(post.shortcode)}>
            Копировать ссылку
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isMine && <EditPostDialog post={post} open={editing} onOpenChange={setEditing} />}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent showClose={false} className="w-[400px] text-center">
          <div className="px-8 pt-8 pb-4">
            <DialogTitle className="text-18 font-normal">Удалить публикацию?</DialogTitle>
            <DialogDescription className="mt-1 text-14 text-muted-foreground">
              Это действие нельзя отменить.
            </DialogDescription>
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={remove}
            className="block h-12 w-full border-t border-border text-14 font-bold text-destructive disabled:opacity-50"
          >
            Удалить
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="block h-12 w-full border-t border-border text-14"
          >
            Отмена
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
