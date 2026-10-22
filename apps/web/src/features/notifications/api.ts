import { baseApi } from '@/lib/api/base-api';
import type { Schemas } from '@/lib/api/types';

type NotificationPage = Schemas['NotificationPageDto'];
type Badges = Schemas['BadgesDto'];

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getNotifications: build.infiniteQuery<NotificationPage, void, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
      },
      query: ({ pageParam }) => ({
        url: '/notifications',
        params: { cursor: pageParam ?? undefined, limit: 20 },
      }),
      providesTags: ['Notification'],
    }),

    markNotificationsRead: build.mutation<void, void>({
      query: () => ({ url: '/notifications/read', method: 'POST', body: {} }),
      invalidatesTags: ['Notification', 'Badge'],
    }),

    getBadges: build.query<Badges, void>({
      query: () => ({ url: '/me/badges' }),
      providesTags: ['Badge'],
    }),
  }),
});

export const {
  useGetNotificationsInfiniteQuery,
  useMarkNotificationsReadMutation,
  useGetBadgesQuery,
} = notificationsApi;
