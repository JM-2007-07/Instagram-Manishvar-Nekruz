import { baseApi } from '@/lib/api/base-api';

import type { PostPage } from '@/features/posts/types';

// Reels — endpoints/posts.md (GET /reels, POST /posts/{id}/plays).
export const reelsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getReels: build.infiniteQuery<PostPage, void, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
      },
      query: ({ pageParam }) => ({ url: '/reels', params: { cursor: pageParam ?? undefined } }),
      providesTags: ['Feed'],
    }),
    // Счётчик воспроизведений: один раз на ролик за просмотр.
    playReel: build.mutation<void, string>({
      query: (postId) => ({ url: `/posts/${postId}/plays`, method: 'POST' }),
    }),
  }),
});

export const { useGetReelsInfiniteQuery, usePlayReelMutation } = reelsApi;
