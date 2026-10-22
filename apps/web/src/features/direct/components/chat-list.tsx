'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SquarePen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGetMeQuery } from '@/features/profile/api';
import { getApiError } from '@/lib/api/errors';
import type { Chat } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { useGetChatsInfiniteQuery, type ChatFolder } from '../api';
import { formatShortTime, getChatAvatarUrl, getChatTitle, getMessagePreview } from '../chat-utils';
import { ChatAvatar } from './chat-avatar';

export function ChatListItem({
  chat,
  meId,
  active,
}: {
  chat: Chat;
  meId: string;
  active: boolean;
}) {
  const title = getChatTitle(chat, meId);
  const unread = chat.unreadCount > 0;
  const peer = chat.type === 'DIRECT' ? chat.participants.find((p) => p.id !== meId) : undefined;

  return (
    <Link
      href={`/direct/t/${chat.id}/`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-6 py-2 outline-none hover:bg-hover-overlay focus-visible:bg-hover-overlay',
        active && 'bg-hover-overlay',
      )}
    >
      <ChatAvatar
        url={getChatAvatarUrl(chat, meId)}
        name={title}
        size={56}
        group={chat.type === 'GROUP'}
        online={peer?.isOnline}
      />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-14', unread ? 'font-semibold' : 'font-normal')}>
          {title}
        </span>
        <span
          className={cn(
            'flex gap-1 text-12 text-muted-foreground',
            unread && 'font-semibold text-foreground',
          )}
        >
          <span className="truncate">{getMessagePreview(chat.lastMessage, meId)}</span>
          <span className="shrink-0">· {formatShortTime(chat.updatedAt)}</span>
        </span>
      </span>
      {unread && (
        <span
          role="img"
          aria-label={`Непрочитанных: ${chat.unreadCount}`}
          className="size-2 shrink-0 rounded-full bg-primary"
        />
      )}
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 px-6 py-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="size-14 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Левая колонка Direct: «Основное / Запросы» и список чатов (SCREENS §3.11).
export function ChatList({
  initialFolder = 'PRIMARY',
  activeChatId,
}: {
  initialFolder?: ChatFolder;
  activeChatId?: string;
}) {
  const [folder, setFolder] = useState<ChatFolder>(initialFolder);
  const { data: me } = useGetMeQuery();
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useGetChatsInfiniteQuery(folder);

  const chats = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section aria-label="Чаты" className="flex h-full min-h-0 flex-col">
      <div className="flex h-[75px] shrink-0 items-center justify-between px-6">
        <h1 className="truncate text-20 font-bold">{me?.userName ?? ''}</h1>
        <Link
          href="/direct/new/"
          aria-label="Новое сообщение"
          className="rounded-lg p-1 hover:bg-hover-overlay"
        >
          <SquarePen className="size-6" />
        </Link>
      </div>

      <div role="tablist" aria-label="Папка" className="flex shrink-0 gap-4 px-6 pb-2">
        {(['PRIMARY', 'REQUESTS'] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={folder === value}
            onClick={() => setFolder(value)}
            className={cn(
              'pb-1 text-16 font-semibold',
              folder === value
                ? 'border-b border-foreground text-foreground'
                : 'text-muted-foreground',
            )}
          >
            {value === 'PRIMARY' ? 'Основное' : 'Запросы'}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && <ListSkeleton />}

        {isError && (
          <div role="alert" className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-14 text-muted-foreground">
              {getApiError(error).code === 'NETWORK_ERROR'
                ? 'Нет соединения с сервером'
                : 'Не удалось загрузить чаты'}
            </p>
            <Button onClick={() => void refetch()}>Повторить</Button>
          </div>
        )}

        {!isLoading && !isError && chats.length === 0 && (
          <p className="p-6 text-center text-14 text-muted-foreground">
            {folder === 'PRIMARY' ? 'Пока нет сообщений' : 'Нет запросов на сообщения'}
          </p>
        )}

        {me &&
          chats.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              meId={me.id}
              active={chat.id === activeChatId}
            />
          ))}

        {hasNextPage && (
          <div className="flex justify-center p-3">
            <Button
              variant="ghost"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              Показать ещё
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
