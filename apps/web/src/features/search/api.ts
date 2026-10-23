import { baseApi } from '@/lib/api/base-api';
import type { Hashtag, Location, Page, Schemas, SearchHistoryEntry } from '@/lib/api/types';

type AddHistoryBody = Schemas['AddSearchHistoryDto'];

const PAGE_SIZE = 20;

export const searchApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Хэштеги и места для поиска. Аккаунты ищет TanStack Query (user-search.ts, ADR 0019).
    findHashtags: build.query<Page<Hashtag>, string>({
      query: (q) => ({ url: '/search/hashtags', params: { q, limit: 10 } }),
    }),
    findLocations: build.query<Page<Location>, string>({
      query: (q) => ({ url: '/search/locations', params: { q, limit: 10 } }),
    }),

    getRecentSearches: build.infiniteQuery<Page<SearchHistoryEntry>, void, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
      },
      query: ({ pageParam }) => ({
        url: '/me/search-history',
        params: { cursor: pageParam ?? undefined, limit: PAGE_SIZE },
      }),
      providesTags: [{ type: 'SearchHistory', id: 'ALL' }],
    }),

    addRecentSearch: build.mutation<SearchHistoryEntry, AddHistoryBody>({
      query: (body) => ({ url: '/me/search-history', method: 'POST', body }),
      invalidatesTags: ['SearchHistory'],
    }),

    removeRecentSearch: build.mutation<void, string>({
      query: (entryId) => ({ url: `/me/search-history/${entryId}`, method: 'DELETE' }),
      invalidatesTags: ['SearchHistory'],
    }),

    clearRecentSearches: build.mutation<void, void>({
      query: () => ({ url: '/me/search-history', method: 'DELETE' }),
      invalidatesTags: ['SearchHistory'],
    }),
  }),
});

export const {
  useFindHashtagsQuery,
  useFindLocationsQuery,
  useGetRecentSearchesInfiniteQuery,
  useAddRecentSearchMutation,
  useRemoveRecentSearchMutation,
  useClearRecentSearchesMutation,
} = searchApi;
