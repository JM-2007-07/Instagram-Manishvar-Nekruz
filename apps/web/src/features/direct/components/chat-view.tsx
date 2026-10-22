'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Info, Phone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGetMeQuery } from '@/features/profile/api';
import { getApiError, showApiError } from '@/lib/api/errors';
import type { Message } from '@/lib/api/types';
import {
  useAcceptChatMutation,
  useDeleteChatMutation,
  useGetChatQuery,
  useGetMessagesInfiniteQuery,
  useMarkChatReadMutation,
} from '../api';
import { formatClock, getChatAvatarUrl, getChatTitle, getPeer, groupMessages } from '../chat-utils';
import { useReadReceipts, useTyping } from '../realtime';
import { useCall } from './call-manager';
import { ChatAvatar } from './chat-avatar';
import { GroupInfo } from './group-info';
import { MessageBubble } from './message-bubble';
import { MessageComposer } from './message-composer';

/** «Просмотрено» под моим последним сообщением: кто-то прочитал его или более новое. */
export function isSeenByOthers(
  newestFirst: Message[],
  receipts: Record<string, string>,
  meId: string,
) {
  const lastMineIndex = newestFirst.findIndex((m) => m.sender?.id === meId);
  if (lastMineIndex < 0) return false;
  return Object.entries(receipts).some(([userId, messageId]) => {
    if (userId === meId) return false;
    const readIndex = newestFirst.findIndex((m) => m.id === messageId);
    return readIndex >= 0 && readIndex <= lastMineIndex;
  });
}

function ChatSkeleton() {
  return (
    <div aria-hidden className="flex flex-1 flex-col justify-end gap-3 p-6">
      {[40, 64, 52].map((w, i) => (
        <div
          key={i}
          style={{ width: `${w}%` }}
          className={`h-9 animate-pulse rounded-3xl bg-muted ${i % 2 ? 'self-end' : ''}`}
        />
      ))}
    </div>
  );
}

export function ChatView({ chatId }: { chatId: string }) {
  const router = useRouter();
  const { data: me } = useGetMeQuery();
  const { data: chat, isLoading, isError, error, refetch } = useGetChatQuery(chatId);
  const {
    data: messagesData,
    isLoading: isMessagesLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useGetMessagesInfiniteQuery(chatId);
  const [markRead] = useMarkChatReadMutation();
  const [accept, { isLoading: isAccepting }] = useAcceptChatMutation();
  const [deleteChat] = useDeleteChatMutation();
  const { startCall } = useCall();
  const receipts = useReadReceipts(chatId);
  const { typingIds, sendTyping } = useTyping(chatId);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const markedRef = useRef<string | null>(null);

  const messages = messagesData?.pages.flatMap((page) => page.items) ?? [];
  const newest = messages[0];

  // Открытый чат считается прочитанным: отмечаем самое новое чужое сообщение.
  useEffect(() => {
    if (!me || !newest || newest.id.startsWith('tmp-')) return;
    if (newest.sender?.id === me.id || markedRef.current === newest.id) return;
    markedRef.current = newest.id;
    void markRead({ chatId, messageId: newest.id });
  }, [me, newest, chatId, markRead]);

  if (isLoading || !me) return <ChatSkeleton />;

  if (isError || !chat) {
    const apiError = getApiError(error);
    return (
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <p className="text-14 text-muted-foreground">
          {apiError.status === 404 ? 'Чат не найден' : 'Не удалось загрузить переписку'}
        </p>
        {apiError.status === 404 ? (
          <Link href="/direct/inbox/" className="text-14 font-semibold text-primary">
            К списку чатов
          </Link>
        ) : (
          <Button onClick={() => void refetch()}>Повторить</Button>
        )}
      </div>
    );
  }

  const title = getChatTitle(chat, me.id);
  const peer = chat.type === 'DIRECT' ? getPeer(chat, me.id) : undefined;
  const typing = typingIds.some((id) => id !== me.id);
  const groups = groupMessages(messages);
  const seen = isSeenByOthers(messages, receipts, me.id);
  const lastMineId = messages.find((m) => m.sender?.id === me.id)?.id;

  async function handleAccept() {
    try {
      await accept(chatId).unwrap();
    } catch (e) {
      showApiError(e);
    }
  }

  async function handleDelete() {
    try {
      await deleteChat(chatId).unwrap();
      router.push('/direct/inbox/');
    } catch (e) {
      showApiError(e);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1">
      <section aria-label={`Переписка: ${title}`} className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[75px] shrink-0 items-center gap-3 border-b border-border px-4">
          <Link href="/direct/inbox/" aria-label="Назад к чатам" className="md:hidden">
            <ChevronLeft className="size-6" />
          </Link>
          <ChatAvatar
            url={getChatAvatarUrl(chat, me.id)}
            name={title}
            size={44}
            group={chat.type === 'GROUP'}
            online={peer?.isOnline}
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-16 font-semibold">{title}</h1>
            <p className="text-12 text-muted-foreground" aria-live="polite">
              {typing ? 'печатает…' : peer?.isOnline ? 'В сети' : ''}
            </p>
          </div>
          {chat.type === 'DIRECT' && !chat.isRequest && (
            <>
              <button
                type="button"
                aria-label="Аудиозвонок"
                onClick={() => void startCall(chat, me.id, 'AUDIO')}
                className="rounded-lg p-1 hover:bg-hover-overlay"
              >
                <Phone className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Видеозвонок"
                onClick={() => void startCall(chat, me.id, 'VIDEO')}
                className="rounded-lg p-1 hover:bg-hover-overlay"
              >
                <Video className="size-6" />
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="Информация о чате"
            aria-pressed={infoOpen}
            onClick={() => setInfoOpen((v) => !v)}
            className="rounded-lg p-1 hover:bg-hover-overlay"
          >
            <Info className="size-6" />
          </button>
        </header>

        {/* column-reverse: низ списка — «дом», подгрузка старых сверху не сдвигает прокрутку */}
        <div
          className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto px-4 py-2"
          onScroll={(e) => {
            const el = e.currentTarget;
            const nearTop = Math.abs(el.scrollTop) + el.clientHeight >= el.scrollHeight - 100;
            if (nearTop && hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
        >
          {isMessagesLoading ? (
            <ChatSkeleton />
          ) : messages.length === 0 ? (
            <p className="m-auto text-14 text-muted-foreground">Напишите первое сообщение</p>
          ) : (
            <div className="flex flex-col gap-3">
              {hasNextPage && (
                <Button
                  variant="ghost"
                  className="self-center"
                  disabled={isFetchingNextPage}
                  onClick={() => void fetchNextPage()}
                >
                  Показать предыдущие
                </Button>
              )}
              {groups.map((group) => (
                <div key={group.key} className="flex flex-col gap-0.5">
                  <p className="my-1 text-center text-12 text-muted-foreground">
                    {formatClock(group.messages[0]!.createdAt)}
                  </p>
                  {group.messages.map((message, i) => (
                    <div key={message.clientId ?? message.id}>
                      <MessageBubble
                        message={message}
                        meId={me.id}
                        me={me}
                        showSender={chat.type === 'GROUP' && i === 0}
                        showAvatar={i === group.messages.length - 1}
                        isFirstInGroup={i === 0}
                        isLastInGroup={i === group.messages.length - 1}
                        onReply={setReplyTo}
                      />
                      {seen && message.id === lastMineId && (
                        <p className="pr-2 text-right text-10 text-muted-foreground">Просмотрено</p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {chat.isRequest ? (
          <div className="flex shrink-0 flex-col items-center gap-2 border-t border-border p-4 text-center">
            <p className="text-14 text-muted-foreground">
              {peer?.userName ?? 'Пользователь'} хочет отправить вам сообщение. Принять запрос?
            </p>
            <div className="flex gap-3">
              <Button disabled={isAccepting} onClick={() => void handleAccept()}>
                Принять
              </Button>
              <Button variant="secondary" onClick={() => void handleDelete()}>
                Удалить
              </Button>
            </div>
          </div>
        ) : (
          <MessageComposer
            chatId={chatId}
            me={me}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
            onTyping={sendTyping}
          />
        )}
      </section>

      {infoOpen && (
        <GroupInfo
          chat={chat}
          meId={me.id}
          onClose={() => setInfoOpen(false)}
          onLeft={() => router.push('/direct/inbox/')}
        />
      )}
    </div>
  );
}
