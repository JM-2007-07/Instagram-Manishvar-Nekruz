'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, MoreHorizontal, Plus } from 'lucide-react';
import { UserAvatar } from '@/components/temp/student-a';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { showApiError } from '@/lib/api/errors';
import type { Schemas } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import {
  useApproveCommentMutation,
  useDeleteCommentMutation,
  useGetCommentLikersInfiniteQuery,
  useGetRepliesInfiniteQuery,
  useLikeCommentMutation,
  usePinCommentMutation,
} from '../api';
import { CommentText, likesLabel, shortTime } from './comment-text';
import { useThread } from './thread-context';
import { StoryAvatar } from '@/features/stories/components/story-avatar-link';

type Comment = Schemas['CommentDto'];

type Props = {
  comment: Comment;
  postId: string;
  /** id верхнего комментария: ответ на ответ уходит в ту же ветку */
  rootId: string;
  meId?: string;
  isPostAuthor: boolean;
  isReply?: boolean;
};

export function CommentItem({ comment, postId, rootId, meId, isPostAuthor, isReply }: Props) {
  const thread = useThread();
  const [likeMutation] = useLikeCommentMutation();
  const [deleteMutation, { isLoading: deleting }] = useDeleteCommentMutation();
  const [pin] = usePinCommentMutation();
  const [approve, { isLoading: approving }] = useApproveCommentMutation();

  // Оптимистичный лайк: меняем локально сразу, при ошибке откатываем.
  const [liked, setLiked] = useState(comment.isLikedByMe);
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [likersOpen, setLikersOpen] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  const isMine = meId === comment.author.id;
  const canDelete = isMine || isPostAuthor;
  const awaitingApproval = comment.isPendingApproval && isPostAuthor && !isMine;

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      await likeMutation({ commentId: comment.id, liked: next }).unwrap();
    } catch (error) {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
      showApiError(error);
    }
  }

  async function remove() {
    try {
      await deleteMutation({ commentId: comment.id, postId }).unwrap();
      setConfirmOpen(false);
    } catch (error) {
      showApiError(error);
    }
  }

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <li className={cn('group', isReply && 'ml-[44px]')}>
      <div className="flex items-start gap-3 py-2">
        <StoryAvatar
          user={comment.author}
          size={32}
          fallbackHref={`/${comment.author.userName}/`}
        />
        <div className="min-w-0 flex-1">
          {comment.isPinned && !isReply && (
            <p className="mb-0.5 text-12 text-muted-foreground">Закреплено</p>
          )}
          <p className="text-14 break-words">
            <Link href={`/${comment.author.userName}/`} className="mr-1 font-semibold">
              {comment.author.userName}
            </Link>
            <CommentText text={comment.text} />
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-12 text-muted-foreground">
            <span>{shortTime(comment.createdAt)}</span>
            {likeCount > 0 && (
              <button type="button" className="font-semibold" onClick={() => setLikersOpen(true)}>
                {likesLabel(likeCount)}
              </button>
            )}
            {thread && (
              <button
                type="button"
                className="font-semibold"
                onClick={() => thread.startReply(rootId, comment.author.userName)}
              >
                Ответить
              </button>
            )}
            {(canDelete || (isPostAuthor && !isReply)) && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Параметры комментария"
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {isPostAuthor && !isReply && (
                    <DropdownMenuItem
                      onClick={() =>
                        run(() =>
                          pin({ commentId: comment.id, pinned: !comment.isPinned }).unwrap(),
                        )
                      }
                    >
                      {comment.isPinned ? 'Открепить' : 'Закрепить'}
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem
                      className="font-bold text-destructive"
                      onClick={() => setConfirmOpen(true)}
                    >
                      Удалить
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {awaitingApproval && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-12">
              <span className="text-muted-foreground">
                Ограниченный пользователь. Комментарий скрыт от других.
              </span>
              <button
                type="button"
                disabled={approving}
                className="font-semibold text-button-borderless"
                onClick={() => run(() => approve(comment.id).unwrap())}
              >
                Одобрить
              </button>
              <button
                type="button"
                className="font-semibold text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                Удалить
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label={liked ? 'Не нравится' : 'Нравится'}
          aria-pressed={liked}
          className="mt-1 shrink-0"
          onClick={toggleLike}
        >
          <Heart
            className={cn('size-3', liked ? 'fill-badge text-badge' : 'text-muted-foreground')}
          />
        </button>
      </div>

      {!isReply && comment.replyCount > 0 && (
        <div className="ml-[44px]">
          <button
            type="button"
            className="flex items-center gap-3 text-12 font-semibold text-muted-foreground"
            onClick={() => setShowReplies((v) => !v)}
          >
            <span className="h-px w-6 bg-border" />
            {showReplies ? 'Скрыть ответы' : `Посмотреть ответы (${comment.replyCount})`}
          </button>
        </div>
      )}
      {showReplies && (
        <Replies commentId={comment.id} postId={postId} meId={meId} isPostAuthor={isPostAuthor} />
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showClose={false} className="w-[400px]">
          <div className="p-6 text-center">
            <DialogTitle className="text-16 font-semibold">Удалить комментарий?</DialogTitle>
            <DialogDescription className="mt-1 text-14 text-muted-foreground">
              Вместе с ним удалятся ответы на него.
            </DialogDescription>
          </div>
          <button
            type="button"
            disabled={deleting}
            className="h-12 w-full border-t border-border text-14 font-bold text-destructive"
            onClick={remove}
          >
            Удалить
          </button>
          <DialogClose className="h-12 w-full border-t border-border text-14">Отмена</DialogClose>
        </DialogContent>
      </Dialog>

      {likersOpen && <LikersDialog commentId={comment.id} onClose={() => setLikersOpen(false)} />}
    </li>
  );
}

function Replies({
  commentId,
  postId,
  meId,
  isPostAuthor,
}: {
  commentId: string;
  postId: string;
  meId?: string;
  isPostAuthor: boolean;
}) {
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage, isLoading } =
    useGetRepliesInfiniteQuery(commentId);
  const replies = data?.pages.flatMap((p) => p.items) ?? [];
  if (isLoading) return <p className="ml-[44px] text-12 text-muted-foreground">Загрузка…</p>;
  return (
    <ul>
      {replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          postId={postId}
          rootId={commentId}
          meId={meId}
          isPostAuthor={isPostAuthor}
          isReply
        />
      ))}
      {hasNextPage && (
        <li className="ml-[44px]">
          <button
            type="button"
            disabled={isFetchingNextPage}
            className="text-12 font-semibold text-muted-foreground"
            onClick={() => fetchNextPage()}
          >
            Показать ещё ответы
          </button>
        </li>
      )}
    </ul>
  );
}

function LikersDialog({ commentId, onClose }: { commentId: string; onClose: () => void }) {
  const { data, hasNextPage, fetchNextPage, isLoading } =
    useGetCommentLikersInfiniteQuery(commentId);
  const users = data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[400px]">
        <DialogTitle className="flex h-[42px] items-center justify-center border-b border-border text-16 font-semibold">
          Отметки &quot;Нравится&quot;
        </DialogTitle>
        <DialogDescription className="sr-only">Кому понравился комментарий</DialogDescription>
        <ul className="max-h-[400px] overflow-y-auto p-2">
          {isLoading && (
            <li className="p-4 text-center text-14 text-muted-foreground">Загрузка…</li>
          )}
          {users.map((user) => (
            <li key={user.id}>
              <Link href={`/${user.userName}/`} className="flex items-center gap-3 px-2 py-2">
                <UserAvatar user={user} size={44} />
                <span>
                  <span className="block text-14 font-semibold">{user.userName}</span>
                  <span className="block text-14 text-muted-foreground">{user.fullName}</span>
                </span>
              </Link>
            </li>
          ))}
          {hasNextPage && (
            <li className="text-center">
              <button
                type="button"
                aria-label="Загрузить ещё"
                className="p-2"
                onClick={() => fetchNextPage()}
              >
                <Plus className="mx-auto size-5" />
              </button>
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
