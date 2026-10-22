import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { ApiErrorBody } from './types';

// Браузер ходит только на свой origin: Next.js проксирует /api/* в NestJS (ADR 0004).
const rawBaseQuery = fetchBaseQuery({ baseUrl: '/api/v1', credentials: 'same-origin' });

const LOGIN_PATH = '/accounts/login/';

// Next.js может открыть страницу и без завершающего «/» (/accounts/login) — учитываем оба вида.
function isLoginPage(pathname: string) {
  return pathname === LOGIN_PATH.slice(0, -1) || pathname.startsWith(LOGIN_PATH);
}

// Сессия потеряна (401 UNAUTHENTICATED) — чистим кэш и ведём на вход.
// INVALID_CREDENTIALS и другие 401 — ошибки форм, их не трогаем.
export const baseQueryWithAuth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  const code = (result.error?.data as Partial<ApiErrorBody> | undefined)?.code;
  if (result.error?.status === 401 && code === 'UNAUTHENTICATED') {
    api.dispatch(baseApi.util.resetApiState());
    // На странице входа уже находимся — повторный переход не нужен.
    if (typeof window !== 'undefined' && !isLoginPage(window.location.pathname)) {
      // Полная перезагрузка намеренно: сбрасывает всё состояние; useRouter вне компонента недоступен.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(LOGIN_PATH);
    }
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    'Me',
    'Settings',
    'Session',
    'User',
    'Follow',
    'FollowRequest',
    'CloseFriend',
    'Privacy',
    'Post',
    'Feed',
    'Comment',
    'Saved',
    'Collection',
    'Hashtag',
    'Story',
    'Highlight',
    'Chat',
    'Message',
    'Call',
    'Notification',
    'Badge',
    'SearchHistory',
    'Location',
    'Report',
  ],
  refetchOnReconnect: true, // после потери сети данные обновятся сами
  endpoints: () => ({}), // эндпоинты добавляют функции через injectEndpoints
});
