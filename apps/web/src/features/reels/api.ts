import { baseApi } from '@/lib/api/base-api';

import type { PostPage } from '@/features/posts/types';

// Reels — endpoints/posts.md (GET /reels, POST /posts/{id}/plays). Страницы склеиваются в один кэш.
export const reelsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getReels: build.query<PostPage, { cursor?: string | null } | void>({
      query: (args) => `/reels${args?.cursor ? `?cursor=${encodeURIComponent(args.cursor)}` : ''}`,
      serializeQueryArgs: ({ endpointName }) => endpointName,
      merge: (cache, page, { arg }) =>
        arg?.cursor
          ? { items: [...cache.items, ...page.items], nextCursor: page.nextCursor }
          : page,
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.cursor !== previousArg?.cursor,
      providesTags: ['Feed'],
    }),
    // Счётчик воспроизведений: один раз на ролик за просмотр.
    playReel: build.mutation<void, string>({
      query: (postId) => ({ url: `/posts/${postId}/plays`, method: 'POST' }),
    }),
  }),
});

export const { useGetReelsQuery, usePlayReelMutation } = reelsApi;
