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
    // Архив историй (для выбора в «Актуальное»).
    getArchivedStories: build.infiniteQuery<StoryPage, void, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
      },
      query: ({ pageParam }) => ({
        url: '/me/archive/stories',
        params: { cursor: pageParam ?? undefined },
      }),
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
    // Просмотр без инвалидации: отмечаем историю в кэше автора, а кольцо в трее гасим,
    // когда у автора не осталось непросмотренных (без списка в кэше — по последней истории).
    viewStory: build.mutation<void, { storyId: string; authorId: string; isLast: boolean }>({
      query: ({ storyId }) => ({ url: `/stories/${storyId}/view`, method: 'PUT' }),
      async onQueryStarted({ storyId, authorId, isLast }, { dispatch, getState, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch {
          return; // просмотр не критичен
        }
        dispatch(
          storiesApi.util.updateQueryData('getUserStories', authorId, (list) => {
            const story = list.find((s) => s.id === storyId);
            if (story) story.isViewedByMe = true;
          }),
        );
        dispatch(
          storiesApi.util.updateQueryData('getStory', storyId, (story) => {
            story.isViewedByMe = true;
          }),
        );
        const list = storiesApi.endpoints.getUserStories.select(authorId)(getState()).data;
        const allSeen = list ? list.every((s) => s.isViewedByMe) : isLast;
        if (!allSeen) return;
        dispatch(
          storiesApi.util.updateQueryData('getStoryTray', undefined, (tray) => {
            const item = tray.find((t) => t.author.id === authorId);
            if (item) item.hasUnseen = false;
          }),
        );
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
  useGetArchivedStoriesInfiniteQuery,
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
