import { baseApi } from '@/lib/api/base-api';
import type { Collection, Schemas } from '@/lib/api/types';

type PostPage = Schemas['PostPageDto'];

const PAGE_SIZE = 24;

const cursorPages = {
  initialPageParam: null as string | null,
  getNextPageParam: (last: { nextCursor: string | null }) => last.nextCursor ?? undefined,
};

export const savedApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSaved: build.infiniteQuery<PostPage, void, string | null>({
      infiniteQueryOptions: cursorPages,
      query: ({ pageParam }) => ({
        url: '/me/saved',
        params: { cursor: pageParam ?? undefined, limit: PAGE_SIZE },
      }),
      providesTags: ['Saved'],
    }),

    getCollections: build.query<Collection[], void>({
      query: () => ({ url: '/me/collections' }),
      providesTags: ['Collection'],
    }),

    getCollectionPosts: build.infiniteQuery<PostPage, string, string | null>({
      infiniteQueryOptions: cursorPages,
      query: ({ queryArg: collectionId, pageParam }) => ({
        url: `/me/collections/${collectionId}/posts`,
        params: { cursor: pageParam ?? undefined, limit: PAGE_SIZE },
      }),
      providesTags: (_result, _error, collectionId) => [{ type: 'Collection', id: collectionId }],
    }),

    // Сохранить / снять сохранение. Оптимистичный вид — в SaveButton (кэш поста принадлежит функции posts).
    savePost: build.mutation<void, { postId: string; saved: boolean }>({
      query: ({ postId, saved }) => ({
        url: `/posts/${postId}/save`,
        method: saved ? 'PUT' : 'DELETE',
      }),
      invalidatesTags: (_result, _error, { postId }) => [
        'Saved',
        'Collection',
        { type: 'Post', id: postId },
      ],
    }),

    createCollection: build.mutation<Collection, { name: string; postIds?: string[] }>({
      query: (body) => ({ url: '/me/collections', method: 'POST', body }),
      invalidatesTags: ['Collection', 'Saved'],
    }),

    updateCollection: build.mutation<Collection, { collectionId: string; name?: string }>({
      query: ({ collectionId, ...body }) => ({
        url: `/me/collections/${collectionId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Collection'],
    }),

    deleteCollection: build.mutation<void, string>({
      query: (collectionId) => ({ url: `/me/collections/${collectionId}`, method: 'DELETE' }),
      invalidatesTags: ['Collection'],
    }),

    addPostToCollection: build.mutation<void, { collectionId: string; postId: string }>({
      query: ({ collectionId, postId }) => ({
        url: `/me/collections/${collectionId}/posts/${postId}`,
        method: 'PUT',
      }),
      invalidatesTags: ['Collection', 'Saved'],
    }),

    removePostFromCollection: build.mutation<void, { collectionId: string; postId: string }>({
      query: ({ collectionId, postId }) => ({
        url: `/me/collections/${collectionId}/posts/${postId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Collection'],
    }),
  }),
});

export const {
  useGetSavedInfiniteQuery,
  useGetCollectionsQuery,
  useGetCollectionPostsInfiniteQuery,
  useSavePostMutation,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
  useAddPostToCollectionMutation,
  useRemovePostFromCollectionMutation,
} = savedApi;
