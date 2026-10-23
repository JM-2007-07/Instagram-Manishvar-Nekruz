import { baseApi } from '@/lib/api/base-api';
import type {
  Call,
  Chat,
  IceServer,
  Message,
  Page,
  SendMessageBody,
  UserSummary,
} from '@/lib/api/types';

export type ChatFolder = 'PRIMARY' | 'REQUESTS';

export const directApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getChats: build.infiniteQuery<Page<Chat>, ChatFolder, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
      },
      query: ({ queryArg: folder, pageParam }) => ({
        url: '/chats',
        params: { folder, cursor: pageParam ?? undefined, limit: 20 },
      }),
      providesTags: [{ type: 'Chat', id: 'LIST' }],
    }),

    getChat: build.query<Chat, string>({
      query: (chatId) => `/chats/${chatId}`,
      providesTags: (_r, _e, chatId) => [{ type: 'Chat', id: chatId }],
    }),

    // Новые сообщения сначала; на экране список переворачивается.
    getMessages: build.infiniteQuery<Page<Message>, string, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
      },
      query: ({ queryArg: chatId, pageParam }) => ({
        url: `/chats/${chatId}/messages`,
        params: { cursor: pageParam ?? undefined, limit: 30 },
      }),
      providesTags: (_r, _e, chatId) => [{ type: 'Message', id: chatId }],
    }),

    // Поиск людей для нового чата
    searchPeople: build.query<Page<UserSummary>, string>({
      query: (q) => ({ url: '/search/users', params: { q } }),
      providesTags: [{ type: 'User', id: 'SEARCH' }],
    }),

    createChat: build.mutation<Chat, { userIds: string[]; title?: string }>({
      query: (body) => ({ url: '/chats', method: 'POST', body }),
      invalidatesTags: [{ type: 'Chat', id: 'LIST' }],
    }),

    updateChat: build.mutation<Chat, { chatId: string; title?: string; avatarMediaId?: string }>({
      query: ({ chatId, ...body }) => ({ url: `/chats/${chatId}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { chatId }) => [
        { type: 'Chat', id: chatId },
        { type: 'Chat', id: 'LIST' },
        { type: 'Message', id: chatId },
      ],
    }),

    addParticipants: build.mutation<Chat, { chatId: string; userIds: string[] }>({
      query: ({ chatId, userIds }) => ({
        url: `/chats/${chatId}/participants`,
        method: 'POST',
        body: { userIds },
      }),
      invalidatesTags: (_r, _e, { chatId }) => [
        { type: 'Chat', id: chatId },
        { type: 'Message', id: chatId },
      ],
    }),

    removeParticipant: build.mutation<void, { chatId: string; userId: string }>({
      query: ({ chatId, userId }) => ({
        url: `/chats/${chatId}/participants/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { chatId }) => [
        { type: 'Chat', id: chatId },
        { type: 'Chat', id: 'LIST' },
        { type: 'Message', id: chatId },
      ],
    }),

    setParticipantAdmin: build.mutation<void, { chatId: string; userId: string; admin: boolean }>({
      query: ({ chatId, userId, admin }) => ({
        url: `/chats/${chatId}/participants/${userId}/admin`,
        method: admin ? 'PUT' : 'DELETE',
      }),
      invalidatesTags: (_r, _e, { chatId }) => [{ type: 'Chat', id: chatId }],
    }),

    acceptChat: build.mutation<void, string>({
      query: (chatId) => ({ url: `/chats/${chatId}/accept`, method: 'POST' }),
      invalidatesTags: (_r, _e, chatId) => [
        { type: 'Chat', id: chatId },
        { type: 'Chat', id: 'LIST' },
      ],
    }),

    deleteChat: build.mutation<void, string>({
      query: (chatId) => ({ url: `/chats/${chatId}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Chat', id: 'LIST' }],
    }),

    muteChat: build.mutation<void, { chatId: string; mute: boolean }>({
      query: ({ chatId, mute }) => ({
        url: `/chats/${chatId}/mute`,
        method: mute ? 'PUT' : 'DELETE',
        body: mute ? {} : undefined,
      }),
      invalidatesTags: (_r, _e, { chatId }) => [
        { type: 'Chat', id: chatId },
        { type: 'Chat', id: 'LIST' },
      ],
    }),

    markChatRead: build.mutation<void, { chatId: string; messageId: string }>({
      query: ({ chatId, messageId }) => ({
        url: `/chats/${chatId}/read`,
        method: 'POST',
        body: { messageId },
      }),
      // Счётчик непрочитанного обнуляем сразу, без повторной загрузки списка.
      async onQueryStarted({ chatId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          directApi.util.updateQueryData('getChats', 'PRIMARY', (draft) => {
            for (const page of draft.pages) {
              for (const chat of page.items) if (chat.id === chatId) chat.unreadCount = 0;
            }
          }),
        );
        try {
          await queryFulfilled;
          dispatch(baseApi.util.invalidateTags([{ type: 'Badge' }]));
        } catch {
          patch.undo();
        }
      },
    }),

    // Оптимистичное сообщение с clientId; ответ сервера или message:new с тем же clientId его заменяет.
    sendMessage: build.mutation<
      Message,
      { chatId: string; body: SendMessageBody; optimistic?: Message }
    >({
      query: ({ chatId, body }) => ({ url: `/chats/${chatId}/messages`, method: 'POST', body }),
      async onQueryStarted({ chatId, optimistic }, { dispatch, queryFulfilled }) {
        if (optimistic) {
          dispatch(
            directApi.util.updateQueryData('getMessages', chatId, (draft) => {
              draft.pages[0]?.items.unshift(optimistic);
            }),
          );
        }
        try {
          const { data } = await queryFulfilled;
          dispatch(
            directApi.util.updateQueryData('getMessages', chatId, (draft) => {
              const items = draft.pages[0]?.items;
              if (!items) return;
              const index = items.findIndex((m) => m.clientId && m.clientId === data.clientId);
              const duplicate = items.findIndex((m) => m.id === data.id);
              if (index >= 0 && duplicate >= 0 && duplicate !== index) items.splice(index, 1);
              else if (index >= 0) items[index] = data;
              else if (duplicate < 0) items.unshift(data);
            }),
          );
        } catch {
          // Не отправлено: убираем оптимистичное сообщение, компонент покажет ошибку.
          if (optimistic) {
            dispatch(
              directApi.util.updateQueryData('getMessages', chatId, (draft) => {
                for (const page of draft.pages) {
                  page.items = page.items.filter((m) => m.id !== optimistic.id);
                }
              }),
            );
          }
        }
      },
      invalidatesTags: [{ type: 'Chat', id: 'LIST' }],
    }),

    editMessage: build.mutation<Message, { chatId: string; messageId: string; text: string }>({
      query: ({ chatId, messageId, text }) => ({
        url: `/chats/${chatId}/messages/${messageId}`,
        method: 'PATCH',
        body: { text },
      }),
      invalidatesTags: (_r, _e, { chatId }) => [
        { type: 'Message', id: chatId },
        { type: 'Chat', id: 'LIST' },
      ],
    }),

    unsendMessage: build.mutation<void, { chatId: string; messageId: string }>({
      query: ({ chatId, messageId }) => ({
        url: `/chats/${chatId}/messages/${messageId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { chatId }) => [
        { type: 'Message', id: chatId },
        { type: 'Chat', id: 'LIST' },
      ],
    }),

    // Реакцию (emoji === null — снять) показываем сразу.
    reactToMessage: build.mutation<
      void,
      { chatId: string; messageId: string; emoji: string | null; me: UserSummary }
    >({
      query: ({ chatId, messageId, emoji }) => ({
        url: `/chats/${chatId}/messages/${messageId}/reaction`,
        method: emoji ? 'PUT' : 'DELETE',
        body: emoji ? { emoji } : undefined,
      }),
      async onQueryStarted({ chatId, messageId, emoji, me }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          directApi.util.updateQueryData('getMessages', chatId, (draft) => {
            for (const page of draft.pages) {
              const message = page.items.find((m) => m.id === messageId);
              if (!message) continue;
              // Одна реакция на пользователя: сначала убираем старую.
              for (const group of message.reactions) {
                group.users = group.users.filter((u) => u.id !== me.id);
              }
              message.reactions = message.reactions.filter((g) => g.users.length > 0);
              if (emoji) {
                const group = message.reactions.find((g) => g.emoji === emoji);
                if (group) group.users.push(me);
                else message.reactions.push({ emoji, users: [me] });
              }
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    // Звонки (T4.A2)
    getIceServers: build.query<{ iceServers: IceServer[] }, void>({
      query: () => '/calls/ice-servers',
      keepUnusedDataFor: 0, // учётные данные TURN временные
    }),

    startCall: build.mutation<Call, { chatId: string; type: Call['type'] }>({
      query: ({ chatId, type }) => ({
        url: `/chats/${chatId}/calls`,
        method: 'POST',
        body: { type },
      }),
      invalidatesTags: [{ type: 'Call', id: 'CURRENT' }],
    }),

    acceptCall: build.mutation<Call, string>({
      query: (callId) => ({ url: `/calls/${callId}/accept`, method: 'POST' }),
      invalidatesTags: (_r, _e, callId) => [{ type: 'Call', id: callId }],
    }),

    declineCall: build.mutation<void, string>({
      query: (callId) => ({ url: `/calls/${callId}/decline`, method: 'POST' }),
      invalidatesTags: (_r, _e, callId) => [{ type: 'Call', id: callId }],
    }),

    endCall: build.mutation<Call, { callId: string; chatId: string }>({
      query: ({ callId }) => ({ url: `/calls/${callId}/end`, method: 'POST' }),
      invalidatesTags: (_r, _e, { callId, chatId }) => [
        { type: 'Call', id: callId },
        { type: 'Message', id: chatId },
      ],
    }),

    getCall: build.query<Call, string>({
      query: (callId) => `/calls/${callId}`,
      providesTags: (_r, _e, callId) => [{ type: 'Call', id: callId }],
    }),
  }),
});

export const {
  useGetChatsInfiniteQuery,
  useGetChatQuery,
  useGetMessagesInfiniteQuery,
  useSearchPeopleQuery,
  useCreateChatMutation,
  useUpdateChatMutation,
  useAddParticipantsMutation,
  useRemoveParticipantMutation,
  useSetParticipantAdminMutation,
  useAcceptChatMutation,
  useDeleteChatMutation,
  useMuteChatMutation,
  useMarkChatReadMutation,
  useSendMessageMutation,
  useEditMessageMutation,
  useUnsendMessageMutation,
  useReactToMessageMutation,
  useGetIceServersQuery,
  useLazyGetIceServersQuery,
  useStartCallMutation,
  useAcceptCallMutation,
  useDeclineCallMutation,
  useEndCallMutation,
  useGetCallQuery,
} = directApi;
