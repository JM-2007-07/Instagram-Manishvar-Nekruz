import { baseApi } from '@/lib/api/base-api';
import type { Schemas } from '@/lib/api/types';
import type {
  Highlight,
  HighlightWithStories,
  Story,
  StoryPage,
  StoryTrayItem,
  StoryViewerPage,
} from './types';

// Истории и «Актуальное» — endpoints/stories.md.
const pageArgs = (cursor?: string | null) =>
  cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';

export const storiesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStoryTray: build.query<StoryTrayItem[], void>({
      query: () => '/stories/tray',
      providesTags: ['Story'],
    }),
    getUserStories: build.query<Story[], string>({
      query: (userId) => `/users/${userId}/stories`,
      providesTags: ['Story'],
    }),
    getStory: build.query<Story, string>({
      query: (storyId) => `/stories/${storyId}`,
      providesTags: ['Story'],
    }),
    getStoryViewers: build.query<StoryViewerPage, string>({
      query: (storyId) => `/stories/${storyId}/viewers`,
      providesTags: ['Story'],
    }),
    // Архив историй (для выбора в «Актуальное»); страницы склеиваются.
    getArchivedStories: build.query<StoryPage, { cursor?: string | null } | void>({
      query: (args) => `/me/archive/stories${pageArgs(args?.cursor)}`,
      serializeQueryArgs: ({ endpointName }) => endpointName,
      merge: (cache, page, { arg }) =>
        arg?.cursor
          ? { items: [...cache.items, ...page.items], nextCursor: page.nextCursor }
          : page,
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.cursor !== previousArg?.cursor,
      providesTags: ['Story'],
    }),
    createStory: build.mutation<Story, Schemas['CreateStoryDto']>({
      query: (body) => ({ url: '/stories', method: 'POST', body }),
      invalidatesTags: ['Story', 'Highlight'],
    }),
    deleteStory: build.mutation<void, string>({
      query: (storyId) => ({ url: `/stories/${storyId}`, method: 'DELETE' }),
      invalidatesTags: ['Story', 'Highlight'],
    }),
    // Просмотр без инвалидации: кольцо в трее гасим вручную, когда просмотрена последняя история автора.
    viewStory: build.mutation<void, { storyId: string; authorId: string; isLast: boolean }>({
      query: ({ storyId }) => ({ url: `/stories/${storyId}/view`, method: 'PUT' }),
      async onQueryStarted({ authorId, isLast }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          if (!isLast) return;
          dispatch(
            storiesApi.util.updateQueryData('getStoryTray', undefined, (tray) => {
              const item = tray.find((t) => t.author.id === authorId);
              if (item) item.hasUnseen = false;
            }),
          );
        } catch {
          // просмотр не критичен
        }
      },
    }),
    likeStory: build.mutation<void, { storyId: string; liked: boolean }>({
      query: ({ storyId, liked }) => ({
        url: `/stories/${storyId}/like`,
        method: liked ? 'PUT' : 'DELETE',
      }),
    }),
    replyStory: build.mutation<unknown, { storyId: string; text: string }>({
      query: ({ storyId, text }) => ({
        url: `/stories/${storyId}/reply`,
        method: 'POST',
        body: { text },
      }),
    }),
    reactStory: build.mutation<unknown, { storyId: string; emoji: string }>({
      query: ({ storyId, emoji }) => ({
        url: `/stories/${storyId}/reactions`,
        method: 'POST',
        body: { emoji },
      }),
    }),

    // Актуальное
    getUserHighlights: build.query<Highlight[], string>({
      query: (userId) => `/users/${userId}/highlights`,
      providesTags: ['Highlight'],
    }),
    getHighlight: build.query<HighlightWithStories, string>({
      query: (highlightId) => `/highlights/${highlightId}`,
      providesTags: ['Highlight'],
    }),
    createHighlight: build.mutation<Highlight, Schemas['HighlightCreateDto']>({
      query: (body) => ({ url: '/highlights', method: 'POST', body }),
      invalidatesTags: ['Highlight'],
    }),
    updateHighlight: build.mutation<Highlight, { highlightId: string; title: string }>({
      query: ({ highlightId, title }) => ({
        url: `/highlights/${highlightId}`,
        method: 'PATCH',
        body: { title },
      }),
      invalidatesTags: ['Highlight'],
    }),
    deleteHighlight: build.mutation<void, string>({
      query: (highlightId) => ({ url: `/highlights/${highlightId}`, method: 'DELETE' }),
      invalidatesTags: ['Highlight'],
    }),
    // Новый состав актуального (удаление истории из него).
    setHighlightStories: build.mutation<Highlight, { highlightId: string; storyIds: string[] }>({
      query: ({ highlightId, storyIds }) => ({
        url: `/highlights/${highlightId}/stories`,
        method: 'PUT',
        body: { storyIds },
      }),
      invalidatesTags: ['Highlight'],
    }),
  }),
});

export const {
  useGetStoryTrayQuery,
  useGetUserStoriesQuery,
  useGetStoryQuery,
  useGetStoryViewersQuery,
  useGetArchivedStoriesQuery,
  useCreateStoryMutation,
  useDeleteStoryMutation,
  useViewStoryMutation,
  useLikeStoryMutation,
  useReplyStoryMutation,
  useReactStoryMutation,
  useGetUserHighlightsQuery,
  useGetHighlightQuery,
  useCreateHighlightMutation,
  useUpdateHighlightMutation,
  useDeleteHighlightMutation,
  useSetHighlightStoriesMutation,
} = storiesApi;
