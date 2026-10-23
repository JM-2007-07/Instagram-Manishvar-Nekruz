import { baseApi } from '@/lib/api/base-api';
import type { Me } from '@/lib/api/types';
import type { Post, PostPage } from './types';

// Публикации и ленты — endpoints/posts.md. Постраничные списки — infiniteQuery (курсор nextCursor).
export const postsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Лента «Главная».
    getFeed: build.infiniteQuery<PostPage, void, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
      },
      query: ({ pageParam }) => ({ url: '/feed', params: { cursor: pageParam ?? undefined } }),
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
  useGetFeedInfiniteQuery,
  useGetCurrentUserQuery,
  useGetPostByShortcodeQuery,
  useLikePostMutation,
  useDeletePostMutation,
} = postsApi;
