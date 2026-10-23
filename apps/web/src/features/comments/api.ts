import { baseApi } from '@/lib/api/base-api';
import type { Schemas } from '@/lib/api/types';

type Comment = Schemas['CommentDto'];
type CommentPage = Schemas['CommentPageDto'];
type LikerPage = Schemas['CommentLikerPageDto'];

const pageParam = {
  initialPageParam: null as string | null,
  getNextPageParam: (last: { nextCursor: string | null }) => last.nextCursor ?? undefined,
};

export const commentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getComments: build.infiniteQuery<CommentPage, string, string | null>({
      infiniteQueryOptions: pageParam,
      query: ({ queryArg: postId, pageParam }) => ({
        url: `/posts/${postId}/comments`,
        params: { cursor: pageParam ?? undefined },
      }),
      providesTags: (_r, _e, postId) => [{ type: 'Comment', id: postId }],
    }),
    getReplies: build.infiniteQuery<CommentPage, string, string | null>({
      infiniteQueryOptions: pageParam,
      query: ({ queryArg: commentId, pageParam }) => ({
        url: `/comments/${commentId}/replies`,
        params: { cursor: pageParam ?? undefined },
      }),
      providesTags: (_r, _e, commentId) => [{ type: 'Comment', id: commentId }],
    }),
    getCommentLikers: build.infiniteQuery<LikerPage, string, string | null>({
      infiniteQueryOptions: pageParam,
      query: ({ queryArg: commentId, pageParam }) => ({
        url: `/comments/${commentId}/likes`,
        params: { cursor: pageParam ?? undefined },
      }),
    }),
    createComment: build.mutation<Comment, { postId: string; text: string; parentId?: string }>({
      query: ({ postId, text, parentId }) => ({
        url: `/posts/${postId}/comments`,
        method: 'POST',
        body: { text, parentId },
      }),
      invalidatesTags: (_r, _e, { postId, parentId }) => [
        { type: 'Comment', id: postId },
        ...(parentId ? [{ type: 'Comment' as const, id: parentId }] : []),
        { type: 'Post', id: postId },
        'Feed',
      ],
    }),
    // Лайк меняет состояние оптимистично в самом компоненте, теги не нужны.
    likeComment: build.mutation<void, { commentId: string; liked: boolean }>({
      query: ({ commentId, liked }) => ({
        url: `/comments/${commentId}/like`,
        method: liked ? 'PUT' : 'DELETE',
      }),
    }),
    deleteComment: build.mutation<void, { commentId: string; postId: string }>({
      query: ({ commentId }) => ({ url: `/comments/${commentId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { postId }) => ['Comment', { type: 'Post', id: postId }, 'Feed'],
    }),
    pinComment: build.mutation<void, { commentId: string; pinned: boolean }>({
      query: ({ commentId, pinned }) => ({
        url: `/comments/${commentId}/pin`,
        method: pinned ? 'PUT' : 'DELETE',
      }),
      invalidatesTags: ['Comment'],
    }),
    approveComment: build.mutation<void, string>({
      query: (commentId) => ({ url: `/comments/${commentId}/approve`, method: 'POST' }),
      invalidatesTags: ['Comment'],
    }),
  }),
});

export const {
  useGetCommentsInfiniteQuery,
  useGetRepliesInfiniteQuery,
  useGetCommentLikersInfiniteQuery,
  useCreateCommentMutation,
  useLikeCommentMutation,
  useDeleteCommentMutation,
  usePinCommentMutation,
  useApproveCommentMutation,
} = commentsApi;
