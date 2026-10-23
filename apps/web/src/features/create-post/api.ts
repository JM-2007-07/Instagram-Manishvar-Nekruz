import { baseApi } from '@/lib/api/base-api';
import type { Schemas } from '@/lib/api/types';
import type { Post, Location } from '@/features/posts/types';
import type { AppDispatch } from '@/lib/store';

// Создание публикации — endpoints/posts.md, поиск мест и людей — endpoints/search.md.
export type CreatePostBody = Schemas['CreatePostDto'];
export type FoundUser = Schemas['FollowListItemDto'];
type MediaItem = Schemas['MediaItemDto'];

export const createPostApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createPost: build.mutation<Post, CreatePostBody>({
      query: (body) => ({ url: '/posts', method: 'POST', body }),
      invalidatesTags: ['Feed', 'Post'],
    }),
    // Статус обработки видео (endpoints/media.md): PROCESSING → READY | FAILED.
    getMediaStatus: build.query<MediaItem, string>({
      query: (mediaId) => `/media/${mediaId}/status`,
    }),
    searchLocations: build.query<{ items: Location[] }, string>({
      query: (q) => `/search/locations?q=${encodeURIComponent(q)}&limit=8`,
      providesTags: ['Location'],
    }),
    searchUsers: build.query<{ items: FoundUser[] }, string>({
      query: (q) => `/search/users?q=${encodeURIComponent(q)}&limit=8`,
    }),
  }),
});

// Видео после загрузки обрабатывается на сервере; публиковать можно только READY.
// Опрашиваем статус раз в intervalMs, пока не станет READY. Ошибки — в формате getApiError.
export async function waitForMediaReady(
  dispatch: AppDispatch,
  mediaId: string,
  { intervalMs = 2000, timeoutMs = 10 * 60 * 1000 } = {},
): Promise<void> {
  const fail = (code: string) => ({ status: 422, data: { statusCode: 422, code, message: code } });
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const media = await dispatch(
      createPostApi.endpoints.getMediaStatus.initiate(mediaId, { forceRefetch: true }),
    ).unwrap();
    if (media.status === 'READY') return;
    if (media.status === 'FAILED') throw fail('MEDIA_FAILED');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw fail('MEDIA_TIMEOUT');
}

export const { useCreatePostMutation, useSearchLocationsQuery, useSearchUsersQuery } =
  createPostApi;
