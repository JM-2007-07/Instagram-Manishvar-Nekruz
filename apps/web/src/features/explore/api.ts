import { baseApi } from '@/lib/api/base-api';
import type { Schemas } from '@/lib/api/types';
import type { PostPage } from '@/features/posts/types';

export type Hashtag = Schemas['HashtagDto'];
export type LocationDetails = Schemas['LocationDetailsDto'];
export type SearchResult = Schemas['SearchResultDto'];
export type SearchHistoryEntry = Schemas['SearchHistoryEntryDto'];
export type SearchHistoryPage = Schemas['SearchHistoryPageDto'];
export type AddSearchHistory = Schemas['AddSearchHistoryDto'];

// «Интересное», хэштег, место, поиск — endpoints/posts.md, tags.md, locations.md, search.md.
const pageOptions = {
  initialPageParam: null as string | null,
  getNextPageParam: (last: { nextCursor: string | null }) => last.nextCursor ?? undefined,
};

export const exploreApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getExplore: build.infiniteQuery<PostPage, void, string | null>({
      infiniteQueryOptions: pageOptions,
      query: ({ pageParam }) => ({ url: '/explore', params: { cursor: pageParam ?? undefined } }),
      providesTags: ['Feed'],
    }),
    getHashtag: build.query<Hashtag, string>({
      query: (name) => `/hashtags/${encodeURIComponent(name)}`,
      providesTags: (_r, _e, name) => [{ type: 'Hashtag', id: name }],
    }),
    getHashtagPosts: build.infiniteQuery<PostPage, string, string | null>({
      infiniteQueryOptions: pageOptions,
      query: ({ queryArg: name, pageParam }) => ({
        url: `/hashtags/${encodeURIComponent(name)}/posts`,
        params: { cursor: pageParam ?? undefined },
      }),
      providesTags: (_r, _e, name) => ['Feed', { type: 'Hashtag', id: name }],
    }),
    getLocation: build.query<LocationDetails, string>({
      query: (id) => `/locations/${encodeURIComponent(id)}`,
      providesTags: (_r, _e, id) => [{ type: 'Location', id }],
    }),
    getLocationPosts: build.infiniteQuery<PostPage, string, string | null>({
      infiniteQueryOptions: pageOptions,
      query: ({ queryArg: id, pageParam }) => ({
        url: `/locations/${encodeURIComponent(id)}/posts`,
        params: { cursor: pageParam ?? undefined },
      }),
      providesTags: (_r, _e, id) => ['Feed', { type: 'Location', id }],
    }),
    search: build.query<SearchResult, string>({
      query: (q) => ({ url: '/search', params: { q } }),
    }),
    getSearchHistory: build.query<SearchHistoryPage, void>({
      query: () => '/me/search-history',
      providesTags: ['SearchHistory'],
    }),
    addSearchHistory: build.mutation<SearchHistoryEntry, AddSearchHistory>({
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
  useGetExploreInfiniteQuery,
  useGetHashtagQuery,
  useGetHashtagPostsInfiniteQuery,
  useGetLocationQuery,
  useGetLocationPostsInfiniteQuery,
  useSearchQuery,
  useGetSearchHistoryQuery,
  useAddSearchHistoryMutation,
  useRemoveSearchHistoryEntryMutation,
  useClearSearchHistoryMutation,
} = exploreApi;
