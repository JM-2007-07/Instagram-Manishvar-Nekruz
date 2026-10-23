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
type CursorArgs = { cursor?: string | null };

const withCursor = (cursor?: string | null) =>
  cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';

// Склейка страниц в один кэш: первая страница заменяет, следующие — дописываются.
const mergePages = (cache: PostPage, page: PostPage, cursor?: string | null): PostPage =>
  cursor ? { items: [...cache.items, ...page.items], nextCursor: page.nextCursor } : page;

export const exploreApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getExplore: build.query<PostPage, CursorArgs>({
      query: ({ cursor }) => `/explore${withCursor(cursor)}`,
      serializeQueryArgs: ({ endpointName }) => endpointName,
      merge: (cache, page, { arg }) => mergePages(cache, page, arg.cursor),
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.cursor !== previousArg?.cursor,
      providesTags: ['Feed'],
    }),
    getHashtag: build.query<Hashtag, string>({
      query: (name) => `/hashtags/${encodeURIComponent(name)}`,
      providesTags: (_r, _e, name) => [{ type: 'Hashtag', id: name }],
    }),
    getHashtagPosts: build.query<PostPage, { name: string } & CursorArgs>({
      query: ({ name, cursor }) =>
        `/hashtags/${encodeURIComponent(name)}/posts${withCursor(cursor)}`,
      serializeQueryArgs: ({ endpointName, queryArgs }) => `${endpointName}-${queryArgs.name}`,
      merge: (cache, page, { arg }) => mergePages(cache, page, arg.cursor),
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.cursor !== previousArg?.cursor,
      providesTags: (_r, _e, { name }) => [{ type: 'Hashtag', id: name }],
    }),
    getLocation: build.query<LocationDetails, string>({
      query: (id) => `/locations/${encodeURIComponent(id)}`,
      providesTags: (_r, _e, id) => [{ type: 'Location', id }],
    }),
    getLocationPosts: build.query<PostPage, { id: string } & CursorArgs>({
      query: ({ id, cursor }) => `/locations/${encodeURIComponent(id)}/posts${withCursor(cursor)}`,
      serializeQueryArgs: ({ endpointName, queryArgs }) => `${endpointName}-${queryArgs.id}`,
      merge: (cache, page, { arg }) => mergePages(cache, page, arg.cursor),
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.cursor !== previousArg?.cursor,
      providesTags: (_r, _e, { id }) => [{ type: 'Location', id }],
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
  useGetExploreQuery,
  useGetHashtagQuery,
  useGetHashtagPostsQuery,
  useGetLocationQuery,
  useGetLocationPostsQuery,
  useSearchQuery,
  useGetSearchHistoryQuery,
  useAddSearchHistoryMutation,
  useRemoveSearchHistoryEntryMutation,
  useClearSearchHistoryMutation,
} = exploreApi;
