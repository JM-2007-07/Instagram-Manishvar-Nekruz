import { baseApi } from '@/lib/api/base-api';
import type { Schemas } from '@/lib/api/types';

export type Suggestion = Schemas['SuggestionDto'];

// Рекомендации аккаунтов — endpoints/follows.md. Лента постов лежит в features/posts/api.ts.
export const feedApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSuggestions: build.query<Suggestion[], { limit?: number } | void>({
      query: (args) => ({ url: '/users/suggestions', params: { limit: args?.limit ?? 5 } }),
      providesTags: ['Follow'],
    }),
  }),
});

export const { useGetSuggestionsQuery } = feedApi;
