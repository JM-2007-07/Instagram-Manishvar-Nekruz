import { baseApi } from '@/lib/api/base-api';
import type { MutedUser, Page, Schemas, UserSummary } from '@/lib/api/types';

type MuteBody = Schemas['MuteDto'];

const PAGE_SIZE = 20;

// Общие настройки бесконечных списков с курсором (ADR 0017).
const cursorPages = {
  initialPageParam: null as string | null,
  getNextPageParam: (last: { nextCursor: string | null }) => last.nextCursor ?? undefined,
};

// Блок, ограничение, скрытие, «скрыть историю от» — теги по API_REQUEST_ARCHITECTURE §6.3.
const afterChange = (_result: unknown, _error: unknown, arg: string | { userId: string }) => [
  'Privacy' as const,
  { type: 'User' as const, id: typeof arg === 'string' ? arg : arg.userId },
  'Feed' as const,
  'Story' as const,
  'Chat' as const,
  'Comment' as const,
];

export const privacyApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBlocked: build.infiniteQuery<Page<UserSummary>, void, string | null>({
      infiniteQueryOptions: cursorPages,
      query: ({ pageParam }) => ({
        url: '/me/blocked',
        params: { cursor: pageParam ?? undefined, limit: PAGE_SIZE },
      }),
      providesTags: ['Privacy'],
    }),

    blockUser: build.mutation<void, string>({
      query: (userId) => ({ url: `/users/${userId}/block`, method: 'PUT' }),
      invalidatesTags: afterChange,
    }),

    unblockUser: build.mutation<void, string>({
      query: (userId) => ({ url: `/users/${userId}/block`, method: 'DELETE' }),
      invalidatesTags: afterChange,
    }),

    getRestricted: build.infiniteQuery<Page<UserSummary>, void, string | null>({
      infiniteQueryOptions: cursorPages,
      query: ({ pageParam }) => ({
        url: '/me/restricted',
        params: { cursor: pageParam ?? undefined, limit: PAGE_SIZE },
      }),
      providesTags: ['Privacy'],
    }),

    restrictUser: build.mutation<void, string>({
      query: (userId) => ({ url: `/users/${userId}/restrict`, method: 'PUT' }),
      invalidatesTags: afterChange,
    }),

    unrestrictUser: build.mutation<void, string>({
      query: (userId) => ({ url: `/users/${userId}/restrict`, method: 'DELETE' }),
      invalidatesTags: afterChange,
    }),

    getMuted: build.infiniteQuery<Page<MutedUser>, void, string | null>({
      infiniteQueryOptions: cursorPages,
      query: ({ pageParam }) => ({
        url: '/me/muted',
        params: { cursor: pageParam ?? undefined, limit: PAGE_SIZE },
      }),
      providesTags: ['Privacy'],
    }),

    muteUser: build.mutation<void, MuteBody & { userId: string }>({
      query: ({ userId, ...body }) => ({ url: `/users/${userId}/mute`, method: 'PUT', body }),
      invalidatesTags: afterChange,
    }),

    unmuteUser: build.mutation<void, string>({
      query: (userId) => ({ url: `/users/${userId}/mute`, method: 'DELETE' }),
      invalidatesTags: afterChange,
    }),

    getStoryHiddenFrom: build.infiniteQuery<Page<UserSummary>, void, string | null>({
      infiniteQueryOptions: cursorPages,
      query: ({ pageParam }) => ({
        url: '/me/story-hidden-from',
        params: { cursor: pageParam ?? undefined, limit: PAGE_SIZE },
      }),
      providesTags: ['Privacy'],
    }),

    hideStoryFrom: build.mutation<void, string>({
      query: (userId) => ({ url: `/me/story-hidden-from/${userId}`, method: 'PUT' }),
      invalidatesTags: afterChange,
    }),

    showStoryTo: build.mutation<void, string>({
      query: (userId) => ({ url: `/me/story-hidden-from/${userId}`, method: 'DELETE' }),
      invalidatesTags: afterChange,
    }),
  }),
});

export const {
  useGetBlockedInfiniteQuery,
  useBlockUserMutation,
  useUnblockUserMutation,
  useGetRestrictedInfiniteQuery,
  useRestrictUserMutation,
  useUnrestrictUserMutation,
  useGetMutedInfiniteQuery,
  useMuteUserMutation,
  useUnmuteUserMutation,
  useGetStoryHiddenFromInfiniteQuery,
  useHideStoryFromMutation,
  useShowStoryToMutation,
} = privacyApi;
