'use client';

// Обработчики событий Direct (REALTIME.md): обновляют кэш RTK Query.
// Подписка — через useRealtimeEvent из lib/realtime.ts (одно подключение Socket.IO на приложение).
import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { baseApi } from '@/lib/api/base-api';
import type { Chat, Message } from '@/lib/api/types';
import { getSocket, useRealtimeEvent } from '@/lib/realtime';
import type { AppDispatch } from '@/lib/store';
import { directApi } from './api';

type ReactionPayload = { chatId: string; messageId: string; reactions: Message['reactions'] };

/** Сообщения и чаты: монтируется один раз в RealtimeBridge (оболочка приложения). */
export function useDirectRealtime() {
  const dispatch = useDispatch<AppDispatch>();

  useRealtimeEvent<{ message: Message }>('message:new', ({ message }) => {
    dispatch(
      directApi.util.updateQueryData('getMessages', message.chatId, (draft) => {
        const first = draft.pages[0];
        if (!first) return;
        // Свою отправку уже показали оптимистично: сопоставляем по clientId.
        const index = first.items.findIndex(
          (m) => m.id === message.id || (m.clientId && m.clientId === message.clientId),
        );
        if (index >= 0) first.items[index] = message;
        else first.items.unshift(message);
      }),
    );
    dispatch(baseApi.util.invalidateTags([{ type: 'Chat', id: 'LIST' }, { type: 'Badge' }]));
  });

  useRealtimeEvent<{ message: Message }>('message:updated', ({ message }) => {
    dispatch(
      directApi.util.updateQueryData('getMessages', message.chatId, (draft) => {
        for (const page of draft.pages) {
          const index = page.items.findIndex((m) => m.id === message.id);
          if (index >= 0) page.items[index] = message;
        }
      }),
    );
    dispatch(baseApi.util.invalidateTags([{ type: 'Chat', id: 'LIST' }]));
  });

  useRealtimeEvent<{ chatId: string; messageId: string }>('message:unsent', (event) => {
    dispatch(
      directApi.util.updateQueryData('getMessages', event.chatId, (draft) => {
        for (const page of draft.pages) {
          page.items = page.items.filter((m) => m.id !== event.messageId);
        }
      }),
    );
    dispatch(baseApi.util.invalidateTags([{ type: 'Chat', id: 'LIST' }]));
  });

  useRealtimeEvent<ReactionPayload>('message:reaction', (event) => {
    dispatch(
      directApi.util.updateQueryData('getMessages', event.chatId, (draft) => {
        for (const page of draft.pages) {
          const message = page.items.find((m) => m.id === event.messageId);
          if (message) message.reactions = event.reactions;
        }
      }),
    );
  });

  useRealtimeEvent<{ chat: Chat }>('chat:updated', ({ chat }) => {
    dispatch(directApi.util.updateQueryData('getChat', chat.id, () => chat));
    dispatch(baseApi.util.invalidateTags([{ type: 'Chat', id: 'LIST' }]));
  });
}

/** Кто что прочитал: { userId → id последнего прочитанного сообщения } (только за время сессии). */
export function useReadReceipts(chatId: string) {
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  useRealtimeEvent<{ chatId: string; userId: string; messageId: string }>('chat:read', (event) => {
    if (event.chatId === chatId)
      setReceipts((prev) => ({ ...prev, [event.userId]: event.messageId }));
  });
  return receipts;
}

/** «Печатает…»: id пользователей, которые сейчас печатают в чате. */
export function useTyping(chatId: string) {
  const [typingIds, setTypingIds] = useState<string[]>([]);

  useRealtimeEvent<{ chatId: string; userId: string; isTyping: boolean }>(
    'chat:typing',
    (event) => {
      if (event.chatId !== chatId) return;
      setTypingIds((prev) => {
        const without = prev.filter((id) => id !== event.userId);
        return event.isTyping ? [...without, event.userId] : without;
      });
      // Индикатор гаснет сам через 5 с, даже если «перестал печатать» не пришло.
      if (event.isTyping) {
        setTimeout(() => setTypingIds((prev) => prev.filter((id) => id !== event.userId)), 5000);
      }
    },
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      getSocket().emit('chat:typing', { chatId, isTyping }, () => {});
    },
    [chatId],
  );

  return { typingIds, sendTyping };
}
