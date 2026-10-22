import { baseApi } from '@/lib/api/base-api';
import type { Me, Profile, Schemas } from '@/lib/api/types';

type PostPage = Schemas['PostPageDto'];

const POSTS_PER_PAGE = 24;

export const profileApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMe: build.query<Me, void>({
      query: () => ({ url: '/me' }),
      providesTags: ['Me'],
    }),

    getProfileByUserName: build.query<Profile, string>({
      query: (userName) => ({ url: `/users/by-username/${encodeURIComponent(userName)}` }),
      providesTags: (result) => (result ? [{ type: 'User', id: result.id }] : []),
    }),

    getUserPosts: build.infiniteQuery<PostPage, string, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
      },
      query: ({ queryArg: userId, pageParam }) => ({
        url: `/users/${userId}/posts`,
        params: { cursor: pageParam ?? undefined, limit: POSTS_PER_PAGE },
      }),
      providesTags: ['Feed'],
    }),

    getUserReels: build.infiniteQuery<PostPage, string, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
      },
      query: ({ queryArg: userId, pageParam }) => ({
        url: `/users/${userId}/reels`,
        params: { cursor: pageParam ?? undefined, limit: POSTS_PER_PAGE },
      }),
      providesTags: ['Feed'],
    }),

    getUserTagged: build.infiniteQuery<PostPage, string, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
      },
      query: ({ queryArg: userId, pageParam }) => ({
        url: `/users/${userId}/tagged`,
        params: { cursor: pageParam ?? undefined, limit: POSTS_PER_PAGE },
      }),
      providesTags: ['Feed'],
    }),

    updateMe: build.mutation<Me, Schemas['UpdateProfileDto']>({
      query: (body) => ({ url: '/me', method: 'PATCH', body }),
      invalidatesTags: ['Me', 'User', 'Settings'],
    }),

    changeUserName: build.mutation<Me, string>({
      query: (userName) => ({ url: '/me/username', method: 'PUT', body: { userName } }),
      invalidatesTags: ['Me', 'User'],
    }),

    requestEmailChange: build.mutation<void, Schemas['ChangeEmailDto']>({
      query: (body) => ({ url: '/me/email', method: 'PUT', body }),
    }),

    verifyEmailChange: build.mutation<Me, string>({
      query: (code) => ({ url: '/me/email/verify', method: 'POST', body: { code } }),
      invalidatesTags: ['Me'],
    }),

    setLinks: build.mutation<Me, Schemas['LinkInputDto'][]>({
      query: (links) => ({ url: '/me/links', method: 'PUT', body: { links } }),
      invalidatesTags: ['Me', 'User'],
    }),

    setAvatar: build.mutation<Me, string>({
      query: (mediaId) => ({ url: '/me/avatar', method: 'PUT', body: { mediaId } }),
      invalidatesTags: ['Me', 'User'],
    }),

    removeAvatar: build.mutation<void, void>({
      query: () => ({ url: '/me/avatar', method: 'DELETE' }),
      invalidatesTags: ['Me', 'User'],
    }),
  }),
});

export const {
  useGetMeQuery,
  useGetProfileByUserNameQuery,
  useGetUserPostsInfiniteQuery,
  useGetUserReelsInfiniteQuery,
  useGetUserTaggedInfiniteQuery,
  useUpdateMeMutation,
  useChangeUserNameMutation,
  useRequestEmailChangeMutation,
  useVerifyEmailChangeMutation,
  useSetLinksMutation,
  useSetAvatarMutation,
  useRemoveAvatarMutation,
} = profileApi;
