'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { CornerUpLeft, MoreHorizontal, Smile } from 'lucide-react';
import { showApiError } from '@/lib/api/errors';
import type { Message, UserSummary } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import {
  useEditMessageMutation,
  useReactToMessageMutation,
  useUnsendMessageMutation,
} from '../api';
import { canEdit, formatClock, isTemp, REACTION_EMOJIS } from '../chat-utils';
import { ChatAvatar } from './chat-avatar';

function MessageBody({ message }: { message: Message }) {
  switch (message.type) {
    case 'MEDIA':
      return (
        <div className="flex flex-col gap-1">
          {message.media.map((item) =>
            item.kind === 'VIDEO' ? (
              <video key={item.id} src={item.url} controls className="max-h-80 rounded-2xl" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={item.id}
                src={item.url}
                alt="Фото из сообщения"
                className="max-h-80 rounded-2xl"
              />
            ),
          )}
          {message.text && <span className="px-1 whitespace-pre-wrap">{message.text}</span>}
        </div>
      );
    case 'VOICE':
      return message.media[0] ? (
        <audio
          src={message.media[0].url}
          controls
          aria-label="Голосовое сообщение"
          className="h-10"
        />
      ) : (
        <span>Голосовое сообщение</span>
      );
    case 'SHARE_POST': {
      const post = message.sharedPost;
      if (!post) return <span>Публикация недоступна</span>;
      const preview = post.items[0]?.media;
      return (
        <Link
          href={`/p/${post.shortcode}/`}
          className="block w-56 overflow-hidden rounded-2xl bg-background text-foreground"
        >
          <span className="block px-3 py-2 text-12 font-semibold">{post.author.userName}</span>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.thumbnailUrl ?? preview.url}
              alt="Публикация"
              className="aspect-square w-full object-cover"
            />
          )}
          {post.caption && (
            <span className="line-clamp-2 block px-3 py-2 text-12">{post.caption}</span>
          )}
        </Link>
      );
    }
    case 'SHARE_PROFILE': {
      const user = message.sharedUser;
      if (!user) return <span>Профиль недоступен</span>;
      return (
        <Link
          href={`/${user.userName}/`}
          className="flex w-56 flex-col items-center gap-2 rounded-2xl bg-background p-4 text-foreground"
        >
          <ChatAvatar url={user.avatarUrl} name={user.userName} size={64} />
          <span className="text-14 font-semibold">{user.userName}</span>
          <span className="text-12 text-muted-foreground">{user.fullName}</span>
        </Link>
      );
    }
    case 'SHARE_STORY':
    case 'STORY_REPLY':
    case 'STORY_REACTION':
      return (
        <span className="whitespace-pre-wrap">
          {message.text ??
            (message.type === 'SHARE_STORY' ? 'Поделился историей' : 'Ответ на историю')}
        </span>
      );
    default:
      return <span className="break-words whitespace-pre-wrap">{message.text}</span>;
  }
}

export function MessageBubble({
  message,
  meId,
  me,
  showSender,
  showAvatar,
  isFirstInGroup,
  isLastInGroup,
  onReply,
}: {
  message: Message;
  meId: string;
  me: UserSummary;
  showSender: boolean;
  showAvatar: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  onReply: (message: Message) => void;
}) {
  const mine = message.sender?.id === meId;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text ?? '');
  const touchStartX = useRef<number | null>(null);

  const [react] = useReactToMessageMutation();
  const [unsend] = useUnsendMessageMutation();
  const [edit, { isLoading: isEditing }] = useEditMessageMutation();

  const myReaction =
    message.reactions.find((g) => g.users.some((u) => u.id === meId))?.emoji ?? null;

  async function setReaction(emoji: string | null) {
    setPickerOpen(false);
    try {
      await react({ chatId: message.chatId, messageId: message.id, emoji, me }).unwrap();
    } catch (error) {
      showApiError(error);
    }
  }

  async function handleUnsend() {
    setMenuOpen(false);
    try {
      await unsend({ chatId: message.chatId, messageId: message.id }).unwrap();
    } catch (error) {
      showApiError(error);
    }
  }

  async function handleEdit() {
    const text = draft.trim();
    if (!text) return;
    try {
      await edit({ chatId: message.chatId, messageId: message.id, text }).unwrap();
      setEditing(false);
    } catch (error) {
      showApiError(error); // EDIT_WINDOW_EXPIRED и др.
    }
  }

  // Системные сообщения и звонки — строка по центру.
  if (message.type === 'SYSTEM' || message.type === 'CALL') {
    const text =
      message.type === 'CALL'
        ? `${message.call?.type === 'VIDEO' ? 'Видеозвонок' : 'Аудиозвонок'}${message.call?.status === 'MISSED' ? ': пропущен' : ''}`
        : (message.text ?? '');
    return <p className="my-2 text-center text-12 text-muted-foreground">{text}</p>;
  }

  const hasCard = message.type === 'SHARE_POST' || message.type === 'SHARE_PROFILE';
  const bubbleShape = mine
    ? cn(
        'rounded-[18px]',
        !isFirstInGroup && 'rounded-tr-[4px]',
        !isLastInGroup && 'rounded-br-[4px]',
      )
    : cn(
        'rounded-[18px]',
        !isFirstInGroup && 'rounded-tl-[4px]',
        !isLastInGroup && 'rounded-bl-[4px]',
      );

  return (
    <div
      className={cn('group flex items-end gap-2', mine ? 'flex-row-reverse' : 'flex-row')}
      onTouchStart={(e) => (touchStartX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        // Свайп вправо на 60 px и больше — ответить на сообщение.
        if (start !== null && (e.changedTouches[0]?.clientX ?? start) - start > 60)
          onReply(message);
      }}
    >
      {!mine && (
        <span className="w-7 shrink-0">
          {showAvatar && message.sender && (
            <ChatAvatar url={message.sender.avatarUrl} name={message.sender.userName} size={28} />
          )}
        </span>
      )}

      <div
        className={cn('flex max-w-[min(70%,564px)] flex-col', mine ? 'items-end' : 'items-start')}
      >
        {showSender && !mine && message.sender && (
          <span className="px-3 pb-0.5 text-12 text-muted-foreground">
            {message.sender.userName}
          </span>
        )}
        {message.replyTo && (
          <span className="mb-[-12px] max-w-full truncate rounded-2xl bg-muted px-3 pt-1.5 pb-4 text-12 text-muted-foreground">
            <CornerUpLeft className="mr-1 inline size-3" aria-hidden />
            {message.replyTo.senderName}: {message.replyTo.text ?? 'Вложение'}
          </span>
        )}

        {editing ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleEdit();
            }}
          >
            <input
              aria-label="Изменить сообщение"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-14"
            />
            <button
              type="submit"
              disabled={isEditing}
              className="text-14 font-semibold text-primary"
            >
              Готово
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-14 text-muted-foreground"
            >
              Отмена
            </button>
          </form>
        ) : (
          <div
            data-testid="bubble"
            title={formatClock(message.createdAt)}
            onDoubleClick={() => void setReaction(myReaction ? null : '❤️')}
            className={cn(
              // Как у Instagram: 15/20, отступы 8/12, скругление 18 (на стыке группы — 4).
              'px-3 py-2 text-15 leading-5 select-text',
              hasCard ? 'p-0' : '',
              hasCard
                ? 'bg-transparent'
                : mine
                  ? 'bg-bubble-outgoing text-primary-foreground'
                  : 'bg-bubble-incoming text-foreground',
              bubbleShape,
              isTemp(message) && 'opacity-60',
            )}
          >
            <MessageBody message={message} />
          </div>
        )}

        {message.reactions.length > 0 && (
          <ul
            aria-label="Реакции"
            className={cn('relative z-10 -mt-2 flex gap-1', mine ? 'pr-2' : 'pl-2')}
          >
            {message.reactions.map((group) => (
              <li
                key={group.emoji}
                className="rounded-full border border-border bg-background px-1.5 text-12"
                title={group.users.map((u) => u.userName).join(', ')}
              >
                {group.emoji}
                {group.users.length > 1 && <span className="ml-0.5">{group.users.length}</span>}
              </li>
            ))}
          </ul>
        )}

        {isLastInGroup && message.editedAt && (
          <span className="px-3 pt-0.5 text-12 text-muted-foreground">Изменено</span>
        )}
      </div>

      {!isTemp(message) && !editing && (
        <div
          className={cn(
            'relative flex items-center gap-1 text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
            mine && 'flex-row-reverse',
          )}
        >
          <button
            type="button"
            aria-label="Ответить"
            onClick={() => onReply(message)}
            className="rounded-full p-1 hover:bg-hover-overlay"
          >
            <CornerUpLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Отреагировать"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded-full p-1 hover:bg-hover-overlay"
          >
            <Smile className="size-4" />
          </button>
          {mine && (
            <button
              type="button"
              aria-label="Ещё"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full p-1 hover:bg-hover-overlay"
            >
              <MoreHorizontal className="size-4" />
            </button>
          )}

          {pickerOpen && (
            <div
              role="menu"
              className="absolute bottom-full z-20 mb-1 flex gap-1 rounded-full border border-border bg-background-elevated p-1.5 shadow-lg"
            >
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  role="menuitem"
                  aria-label={`Реакция ${emoji}`}
                  onClick={() => void setReaction(emoji === myReaction ? null : emoji)}
                  className="rounded-full px-1 text-20 hover:bg-hover-overlay"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {menuOpen && (
            <div
              role="menu"
              className="absolute bottom-full z-20 mb-1 flex w-44 flex-col rounded-xl border border-border bg-background-elevated py-1 text-14 shadow-lg"
            >
              {canEdit(message, meId) && (
                <button
                  type="button"
                  role="menuitem"
                  className="px-4 py-2 text-left hover:bg-hover-overlay"
                  onClick={() => {
                    setMenuOpen(false);
                    setDraft(message.text ?? '');
                    setEditing(true);
                  }}
                >
                  Изменить
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className="px-4 py-2 text-left font-semibold text-destructive hover:bg-hover-overlay"
                onClick={() => void handleUnsend()}
              >
                Отменить отправку
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
