import { baseApi } from '@/lib/api/base-api';
import type { Page, Schemas, SearchHistoryEntry, SearchResult } from '@/lib/api/types';

type AddHistoryBody = Schemas['AddSearchHistoryDto'];

const PAGE_SIZE = 20;

export const searchApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Аккаунты, хэштеги, места — до 10 каждого. Пустая строка: вызывающий передаёт skip.
    search: build.query<SearchResult, string>({
      query: (q) => ({ url: '/search', params: { q } }),
    }),

    getSearchHistory: build.infiniteQuery<Page<SearchHistoryEntry>, void, string | null>({
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

    addSearchHistory: build.mutation<SearchHistoryEntry, AddHistoryBody>({
      query: (body) => ({ url: '/me/search-history', method: 'POST', body }),
      invalidatesTags: ['SearchHistory'],
    }),

    removeSearchHistoryEntry: build.mutation<void, string>({
      query: (entryId) => ({ url: `/me/search-history/${entryId}`, method: 'DELETE' }),
      invalidatesTags: ['SearchHistory'],
    }),

    clearSearchHistory: build.mutation<void, void>({
      query: () => ({ url: '/me/search-history', method: 'DELETE' }),
      invalidatesTags: ['SearchHistory'],
    }),
  }),
});

export const {
  useSearchQuery,
  useGetSearchHistoryInfiniteQuery,
  useAddSearchHistoryMutation,
  useRemoveSearchHistoryEntryMutation,
  useClearSearchHistoryMutation,
} = searchApi;
