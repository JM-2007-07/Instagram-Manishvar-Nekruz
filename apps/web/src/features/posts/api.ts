import { baseApi } from '@/lib/api/base-api';
import type { Me } from '@/lib/api/types';
import type { Post, PostPage } from './types';

// Публикации и ленты — endpoints/posts.md. Списки с курсором склеиваются в один кэш (бесконечная прокрутка).
const pageArgs = (cursor?: string | null) =>
  cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';

export const postsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Лента «Главная»; страницы склеиваются, следующая — передать nextCursor.
    getFeed: build.query<PostPage, { cursor?: string | null } | void>({
      query: (args) => `/feed${pageArgs(args?.cursor)}`,
      serializeQueryArgs: ({ endpointName }) => endpointName,
      merge: (cache, page, { arg }) =>
        arg?.cursor
          ? { items: [...cache.items, ...page.items], nextCursor: page.nextCursor }
          : page,
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.cursor !== previousArg?.cursor,
      providesTags: ['Feed'],
    }),
    // Текущий пользователь — чтобы понять, свой ли это пост.
    getCurrentUser: build.query<Me, void>({
      query: () => '/me',
      providesTags: ['Me'],
    }),
    getPostByShortcode: build.query<Post, string>({
      query: (shortcode) => `/posts/by-shortcode/${encodeURIComponent(shortcode)}`,
      providesTags: (post) => (post ? [{ type: 'Post', id: post.id }] : []),
    }),
    // «Нравится» / снять: PUT / DELETE /posts/{id}/like. Состояние меняет вызывающий оптимистично.
    likePost: build.mutation<void, { postId: string; liked: boolean }>({
      query: ({ postId, liked }) => ({
        url: `/posts/${postId}/like`,
        method: liked ? 'PUT' : 'DELETE',
      }),
    }),
    deletePost: build.mutation<void, string>({
      query: (postId) => ({ url: `/posts/${postId}`, method: 'DELETE' }),
      invalidatesTags: ['Feed', 'Post'],
    }),
  }),
});

export const {
  useGetFeedQuery,
  useGetCurrentUserQuery,
  useGetPostByShortcodeQuery,
  useLikePostMutation,
  useDeletePostMutation,
} = postsApi;
