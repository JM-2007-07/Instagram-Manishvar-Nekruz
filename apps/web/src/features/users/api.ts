import { baseApi } from '@/lib/api/base-api';
import type {
  FollowListItem,
  FollowRequestItem,
  Page,
  Schemas,
  Suggestion,
  UserSummary,
} from '@/lib/api/types';

type FollowResult = Schemas['FollowResultDto'];

const PAGE_SIZE = 20;

// Общие настройки бесконечных списков с курсором (ADR 0017).
const cursorPages = {
  initialPageParam: null as string | null,
  getNextPageParam: (last: { nextCursor: string | null }) => last.nextCursor ?? undefined,
};

export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getFollowers: build.infiniteQuery<
      Page<FollowListItem>,
      { userId: string; q?: string },
      string | null
    >({
      infiniteQueryOptions: cursorPages,
      query: ({ queryArg: { userId, q }, pageParam }) => ({
        url: `/users/${userId}/followers`,
        params: { q: q || undefined, cursor: pageParam ?? undefined, limit: PAGE_SIZE },
      }),
      providesTags: (_result, _error, { userId }) => [{ type: 'Follow', id: userId }],
    }),

    getFollowing: build.infiniteQuery<
      Page<FollowListItem>,
      { userId: string; q?: string },
      string | null
    >({
      infiniteQueryOptions: cursorPages,
      query: ({ queryArg: { userId, q }, pageParam }) => ({
        url: `/users/${userId}/following`,
        params: { q: q || undefined, cursor: pageParam ?? undefined, limit: PAGE_SIZE },
      }),
      providesTags: (_result, _error, { userId }) => [{ type: 'Follow', id: userId }],
    }),

    followUser: build.mutation<FollowResult, string>({
      query: (userId) => ({ url: `/users/${userId}/follow`, method: 'PUT' }),
      invalidatesTags: (_result, _error, userId) => [
        { type: 'User', id: userId },
        'Follow',
        'Feed',
        'Story',
      ],
    }),

    unfollowUser: build.mutation<void, string>({
      query: (userId) => ({ url: `/users/${userId}/follow`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, userId) => [
        { type: 'User', id: userId },
        'Follow',
        'Feed',
        'Story',
      ],
    }),

    removeFollower: build.mutation<void, string>({
      query: (userId) => ({ url: `/me/followers/${userId}`, method: 'DELETE' }),
      invalidatesTags: ['FollowRequest', 'Follow', 'User', 'Badge'],
    }),

    getFollowRequests: build.infiniteQuery<Page<FollowRequestItem>, void, string | null>({
      infiniteQueryOptions: cursorPages,
      query: ({ pageParam }) => ({
        url: '/me/follow-requests',
        params: { cursor: pageParam ?? undefined, limit: PAGE_SIZE },
      }),
      providesTags: ['FollowRequest'],
    }),

    acceptFollowRequest: build.mutation<void, string>({
      query: (userId) => ({ url: `/me/follow-requests/${userId}/accept`, method: 'POST' }),
      invalidatesTags: ['FollowRequest', 'Follow', 'User', 'Badge'],
    }),

    declineFollowRequest: build.mutation<void, string>({
      query: (userId) => ({ url: `/me/follow-requests/${userId}`, method: 'DELETE' }),
      invalidatesTags: ['FollowRequest', 'Follow', 'User', 'Badge'],
    }),

    getCloseFriends: build.infiniteQuery<Page<UserSummary>, void, string | null>({
      infiniteQueryOptions: cursorPages,
      query: ({ pageParam }) => ({
        url: '/me/close-friends',
        params: { cursor: pageParam ?? undefined, limit: PAGE_SIZE },
      }),
      providesTags: ['CloseFriend'],
    }),

    addCloseFriend: build.mutation<void, string>({
      query: (userId) => ({ url: `/me/close-friends/${userId}`, method: 'PUT' }),
      invalidatesTags: ['CloseFriend', 'Story'],
    }),

    removeCloseFriend: build.mutation<void, string>({
      query: (userId) => ({ url: `/me/close-friends/${userId}`, method: 'DELETE' }),
      invalidatesTags: ['CloseFriend', 'Story'],
    }),

    getFavoriteAccounts: build.query<UserSummary[], void>({
      query: () => ({ url: '/me/favorite-accounts' }),
      providesTags: ['CloseFriend'],
    }),

    addFavoriteAccount: build.mutation<void, string>({
      query: (userId) => ({ url: `/me/favorite-accounts/${userId}`, method: 'PUT' }),
      invalidatesTags: ['CloseFriend', 'Feed'],
    }),

    removeFavoriteAccount: build.mutation<void, string>({
      query: (userId) => ({ url: `/me/favorite-accounts/${userId}`, method: 'DELETE' }),
      invalidatesTags: ['CloseFriend', 'Feed'],
    }),

    getSuggestions: build.query<Suggestion[], number | void>({
      query: (limit) => ({ url: '/users/suggestions', params: { limit: limit || undefined } }),
      providesTags: [{ type: 'User', id: 'SUGGESTIONS' }],
    }),
  }),
});

export const {
  useGetFollowersInfiniteQuery,
  useGetFollowingInfiniteQuery,
  useFollowUserMutation,
  useUnfollowUserMutation,
  useRemoveFollowerMutation,
  useGetFollowRequestsInfiniteQuery,
  useAcceptFollowRequestMutation,
  useDeclineFollowRequestMutation,
  useGetCloseFriendsInfiniteQuery,
  useAddCloseFriendMutation,
  useRemoveCloseFriendMutation,
  useGetFavoriteAccountsQuery,
  useAddFavoriteAccountMutation,
  useRemoveFavoriteAccountMutation,
  useGetSuggestionsQuery,
} = usersApi;
