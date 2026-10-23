import { baseApi } from '@/lib/api/base-api';
import type { Schemas } from '@/lib/api/types';
import type { Post, Location } from '@/features/posts/types';

// Создание публикации — endpoints/posts.md, поиск мест и людей — endpoints/search.md.
export type CreatePostBody = Schemas['CreatePostDto'];
export type FoundUser = Schemas['FollowListItemDto'];

export const createPostApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createPost: build.mutation<Post, CreatePostBody>({
      query: (body) => ({ url: '/posts', method: 'POST', body }),
      invalidatesTags: ['Feed', 'Post'],
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

export const { useCreatePostMutation, useSearchLocationsQuery, useSearchUsersQuery } =
  createPostApi;
