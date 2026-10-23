'use client';

import { useGetCurrentUserQuery } from '@/features/posts/api';
// Комментарии публикации (T3.B5): список с ответами и поле ввода. Сигнатуры согласованы с окном поста (T3.B1).
import { useState } from 'react';
import { Plus, Smile } from 'lucide-react';
import type { Post } from '@/features/posts/types';
import { showApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { useCreateCommentMutation, useGetCommentsInfiniteQuery } from '../api';
import { CommentItem } from './comment-item';
import { ThreadProvider, useThread } from './thread-context';

type FormProps = { post: Post; variant?: 'dialog' | 'card'; autoFocus?: boolean };

/** Общий контекст ответа: «Ответить» в списке подставляет @имя в CommentForm. Оборачивает список и форму. */
export function CommentThreadProvider({ children }: { postId: string; children: React.ReactNode }) {
  return <ThreadProvider>{children}</ThreadProvider>;
}

/** Список комментариев с ответами в окне поста (без подписи автора — её рисует окно поста). */
export function PostComments({ post }: { post: Post }) {
  const { data: me } = useGetCurrentUserQuery();
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage, refetch } =
    useGetCommentsInfiniteQuery(post.id, { skip: post.commentsDisabled });

  if (post.commentsDisabled) {
    return (
      <p className="py-6 text-center text-14 text-muted-foreground">
        Комментарии к этой публикации отключены
      </p>
    );
  }
  if (isLoading) return <p className="py-6 text-center text-14 text-muted-foreground">Загрузка…</p>;
  if (isError) {
    return (
      <div className="py-6 text-center text-14">
        <p className="text-muted-foreground">Не удалось загрузить комментарии.</p>
        <button
          type="button"
          className="mt-2 font-semibold text-button-borderless"
          onClick={() => refetch()}
        >
          Повторить
        </button>
      </div>
    );
  }

  const comments = data?.pages.flatMap((p) => p.items) ?? [];
  if (comments.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-24 font-bold">Комментариев пока нет.</p>
        <p className="mt-1 text-14 text-muted-foreground">Начните переписку.</p>
      </div>
    );
  }

  const isPostAuthor = me?.id === post.author.id;
  return (
    <>
      <ul>
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            postId={post.id}
            rootId={comment.id}
            meId={me?.id}
            isPostAuthor={isPostAuthor}
          />
        ))}
      </ul>
      {hasNextPage && (
        <button
          type="button"
          aria-label="Загрузить ещё"
          disabled={isFetchingNextPage}
          className="mx-auto my-3 flex size-8 items-center justify-center rounded-full border border-border"
          onClick={() => fetchNextPage()}
        >
          <Plus className="size-5" />
        </button>
      )}
    </>
  );
}

const EMOJIS = [
  '😀',
  '😂',
  '😍',
  '🥰',
  '😎',
  '🤔',
  '😢',
  '😡',
  '👍',
  '👏',
  '🙌',
  '🙏',
  '🔥',
  '❤️',
  '💯',
  '🎉',
  '✨',
  '😮',
  '🤣',
  '😉',
];

/** Поле «Добавьте комментарий…» с эмодзи и «Опубликовать». variant card — в карточке ленты. */
export function CommentForm({ post, variant = 'dialog', autoFocus }: FormProps) {
  const thread = useThread();
  const [localText, setLocalText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [createComment, { isLoading }] = useCreateCommentMutation();

  if (post.commentsDisabled) return null;

  // Внутри провайдера текст общий (чтобы «Ответить» мог его заполнить), без него — локальный.
  const text = thread ? thread.text : localText;
  const setText = thread ? thread.setText : setLocalText;
  const isCard = variant === 'card';
  const canSubmit = text.trim().length > 0 && !isLoading;

  async function submit() {
    if (!canSubmit) return;
    try {
      await createComment({
        postId: post.id,
        text: text.trim(),
        parentId: thread?.replyTo?.commentId,
      }).unwrap();
      if (thread) thread.clearReply();
      else setLocalText('');
    } catch (error) {
      showApiError(error);
    }
  }

  const emojiButton = (
    <button
      type="button"
      aria-label="Эмодзи"
      className="shrink-0"
      onClick={() => setEmojiOpen((v) => !v)}
    >
      <Smile className={cn(isCard ? 'size-4 text-muted-foreground' : 'size-6')} />
    </button>
  );

  return (
    <form
      className={cn(
        'relative flex items-center gap-3',
        isCard ? 'py-1' : 'border-t border-border px-4 py-3',
      )}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {!isCard && emojiButton}
      <textarea
        ref={thread?.inputRef}
        aria-label="Добавьте комментарий…"
        placeholder="Добавьте комментарий…"
        rows={1}
        autoFocus={autoFocus}
        value={text}
        maxLength={2200}
        className="max-h-20 min-h-[18px] flex-1 resize-none bg-transparent text-14 outline-none [field-sizing:content] placeholder:text-muted-foreground"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      {(!isCard || text.length > 0) && (
        <button
          type="submit"
          disabled={!canSubmit}
          className="shrink-0 text-14 font-semibold text-button-borderless hover:text-button-borderless-hover disabled:opacity-30"
        >
          Опубликовать
        </button>
      )}
      {isCard && emojiButton}
      {emojiOpen && (
        <div className="absolute bottom-full left-0 z-20 mb-1 grid grid-cols-5 gap-1 rounded-xl bg-popover p-2 shadow-[var(--shadow-strong)]">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="size-8 rounded-lg text-20 hover:bg-hover-overlay"
              onClick={() => setText(text + emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
