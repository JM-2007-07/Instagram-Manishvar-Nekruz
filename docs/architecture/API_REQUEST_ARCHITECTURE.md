# Архитектура запросов frontend → backend

> Статус: ✅ согласовано: same-origin прокси ([ADR 0004](../decisions/0004-same-origin-proxy.md)),
> **RTK Query** ([ADR 0010](../decisions/0010-rtk-query.md)), типы из Swagger ([ADR 0006](../decisions/0006-openapi-generated-types.md)).
> Фрагменты кода — **образцы формы** для Redux Toolkit 2.x (проверено по 2.13.0), а не готовая реализация.

## 1. Цели

- **Один способ** запросов из браузера — хуки RTK Query. Других клиентов нет.
- Код запросов **простой и однообразный**: каждая функция описывает свои эндпоинты одинаково.
- Типы запросов и ответов берутся из Swagger backend, а не придумываются.
- Cookie сессии недоступна JavaScript (HttpOnly) и никогда не читается frontend-кодом.
- Бизнес-логика только в NestJS; Next.js её не повторяет.

## 2. Как браузер достигает NestJS: сравнение вариантов

| Вариант | Плюсы | Минусы |
|---|---|---|
| A. Браузер → NestJS напрямую (другой origin, CORS с `credentials`) | нет промежуточного звена | нужны CORS с credentials, `SameSite=None` или общий домен, сложнее CSRF; разные адреса в dev и prod |
| **B. Next.js rewrites: `/api/*` → NestJS** ✅ | браузер видит один origin; cookie первого лица, `SameSite=Lax`; CORS не нужен; одна строка конфигурации; логики в Next.js нет | лишний сетевой переход через Next.js; нужно проверить загрузку больших файлов через прокси (Phase 0) |
| C. Полноценный BFF: Route Handlers Next.js вызывают NestJS | можно агрегировать данные | дублирование маршрутов и логики в двух местах; больше кода для объяснения |

**Выбран вариант B.** Это прозрачный прокси, а не BFF: в Next.js нет обработчиков `/api/*`,
есть только правило перезаписи в `next.config.ts`:

```ts
// apps/web/next.config.ts (образец)
async rewrites() {
  return [{ source: '/api/:path*', destination: `${process.env.API_INTERNAL_URL}/api/:path*` }];
}
```

**Проверка в Phase 0 (обязательно):** через rewrite проходят `Set-Cookie`, `multipart/form-data`
размером до лимита видео и заголовок `Origin`. Если что-то не проходит — запасной вариант:
один Route Handler `app/api/[...path]/route.ts`, который потоково пересылает запрос. Решение фиксируется в ADR.

В продакшене тот же эффект может дать обратный прокси (nginx/Caddy) перед обоими приложениями — зависит от Q24.

## 3. Единый источник адреса backend

| Где выполняется код | Базовый адрес | Откуда |
|---|---|---|
| Браузер (RTK Query) | `/api/v1` (относительный) | константа в `lib/api/base-api.ts` |
| Сервер Next.js (`serverFetch`, `next.config.ts`) | `${API_INTERNAL_URL}/api/v1` | `apps/web/.env.local`, проверяется при старте |
| Браузер (Socket.IO) | `NEXT_PUBLIC_REALTIME_URL` | `apps/web/.env.local` — единственный публичный адрес ([ADR 0013](../decisions/0013-realtime-socketio.md)) |

Переменной `NEXT_PUBLIC_API_URL` нет: REST браузер вызывает только через относительный `/api/v1`.

## 4. Устройство API-слоя

```
src/lib/
├── api/
│   ├── schema.d.ts      # СГЕНЕРИРОВАН openapi-typescript из docs/api/openapi.json — не редактировать
│   ├── types.ts         # понятные псевдонимы: Post, Profile, Page<T>, ApiErrorBody
│   ├── base-api.ts      # createApi: baseQuery, tagTypes, пустой список эндпоинтов
│   ├── errors.ts        # getApiError(): ошибка RTK Query → { status, code, message, details }
│   └── server.ts        # serverFetch() — только для Server Components (server-only)
├── store.ts             # makeStore(): store только с baseApi
└── store-provider.tsx   # 'use client' — создаёт store один раз, <Provider>
src/features/<name>/api.ts   # baseApi.injectEndpoints(...) — эндпоинты и хуки функции
```

### 4.1 `base-api.ts` — один на всё приложение

```ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { ApiErrorBody } from './types';

const rawBaseQuery = fetchBaseQuery({ baseUrl: '/api/v1' });

// Если сессии нет (истекла или выход на другом устройстве) — очищаем кэш и ведём на страницу входа.
// Проверяем именно код UNAUTHENTICATED: «неверный пароль» при входе (INVALID_CREDENTIALS) — тоже 401,
// но это ошибка формы, а не потеря сессии.
const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args, api, extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  const code = (result.error?.data as ApiErrorBody | undefined)?.code;
  if (result.error?.status === 401 && code === 'UNAUTHENTICATED') {
    api.dispatch(baseApi.util.resetApiState());
    window.location.assign('/accounts/login/');
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  tagTypes: ['Me', 'Settings', 'Session', 'User', 'Follow', 'FollowRequest', 'CloseFriend', 'Privacy',
             'Post', 'Feed', 'Comment', 'Saved', 'Collection', 'Hashtag', 'Story', 'Highlight',
             'Chat', 'Message', 'Call', 'Notification', 'Badge', 'SearchHistory', 'Location', 'Report'],
  refetchOnReconnect: true,  // после потери сети данные обновятся сами
  endpoints: () => ({}),     // эндпоинты добавляют функции через injectEndpoints
});
```

### 4.2 Store и Provider

```ts
// lib/store.ts
export function makeStore() {
  const store = configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
  });
  setupListeners(store.dispatch);   // для refetchOnReconnect
  return store;
}
export type AppStore = ReturnType<typeof makeStore>;
```

```tsx
// lib/store-provider.tsx
'use client';
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore);   // один store на вкладку браузера
  return <Provider store={store}>{children}</Provider>;
}
```

- Store создаётся внутри компонента, а **не** глобальной переменной модуля: на сервере Next.js глобальный store
  был бы общим для всех пользователей.
- В store только RTK Query. Своих slice'ов нет: локальное состояние UI — `useState`. Новый slice — только с ADR.
- `StoreProvider` подключается в корневом `app/layout.tsx` вместе с Toaster.

### 4.3 Типы

```ts
// lib/api/types.ts — короткие имена вместо длинных путей в сгенерированных типах
import type { components } from './schema';
type Schemas = components['schemas'];

export type Post = Schemas['PostResponseDto'];        // имена DTO фиксируются в NestJS (T0.2 и далее)
export type Profile = Schemas['ProfileResponseDto'];
export type Page<T> = { items: T[]; nextCursor: string | null };   // ADR 0017
export type ApiErrorBody = Schemas['ApiErrorDto'];
```

Типы **не пишутся вручную** по памяти: псевдоним ссылается на сгенерированный тип. Если DTO переименовали —
`npm run typecheck` покажет все места.

## 5. Server Components

Server Components **не загружают данные страниц** (ADR 0010). Они делают только то, что нельзя сделать на клиенте:

| Где | Что | Как |
|---|---|---|
| layout `(main)` | проверка сессии до показа приложения | `serverFetch('/me')` с cookie пользователя; `401` → `redirect('/accounts/login/')` |
| layout `(auth)` | вошедший пользователь не видит страницу входа | `serverFetch('/me')`; `200` → `redirect('/')` |
| `generateMetadata` (по необходимости) | заголовок вкладки | `serverFetch` |

```ts
// lib/api/server.ts (образец)
import 'server-only';
import { cookies } from 'next/headers';

export async function serverFetch<T>(path: string): Promise<{ status: number; data: T | null }> {
  const response = await fetch(`${env.API_INTERNAL_URL}/api/v1${path}`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',            // персональные данные не кэшируются Next.js
  });
  return { status: response.status, data: response.ok ? ((await response.json()) as T) : null };
}
```

Только `GET`. Server Components не устанавливают cookie — продление сессии происходит на запросах браузера.

## 6. Client Components: RTK Query

### 6.1 Почему RTK Query

| Вариант | Оценка |
|---|---|
| `fetch` + `useEffect` + `useState` | для каждого экрана вручную: загрузка, ошибки, гонки запросов, обновление после изменений |
| TanStack Query | хорош, но команда выбрала RTK Query (ADR 0010) |
| **RTK Query** ✅ | все эндпоинты описаны в одном стиле; хуки генерируются автоматически; кэш и инвалидация **тегами** — понятная модель «запрос предоставляет тег, изменение его сбрасывает»; бесконечные ленты, опрос, оптимистичные обновления — встроены |

**Server Actions для изменений не используются**: все изменения — мутации RTK Query → `/api/v1`.

### 6.2 Эндпоинты функции — образец

```ts
// features/posts/api.ts
import { baseApi } from '@/lib/api/base-api';
import type { Page, Post } from '@/lib/api/types';

export const postsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPost: build.query<Post, string>({
      query: (postId) => `/posts/${postId}`,
      providesTags: (_result, _error, postId) => [{ type: 'Post', id: postId }],
    }),

    getFeed: build.infiniteQuery<Page<Post>, void, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,                                   // первая страница — без курсора
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
      query: ({ pageParam }) => ({ url: '/feed', params: { cursor: pageParam ?? undefined, limit: 20 } }),
      providesTags: ['Feed'],
    }),

    deletePost: build.mutation<void, string>({
      query: (postId) => ({ url: `/posts/${postId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, postId) => [{ type: 'Post', id: postId }, 'Feed'],
    }),
  }),
});

export const { useGetPostQuery, useGetFeedInfiniteQuery, useDeletePostMutation } = postsApi;
```

Правила, которые делают код однообразным:

1. Один файл `api.ts` на функцию; один вызов `injectEndpoints`; хуки экспортируются в конце файла.
2. Имена: чтение — `getX` (бесконечный список — тоже `getX`, хук `useGetXInfiniteQuery`), изменение — глагол:
   `createPost`, `deletePost`, `likePost`, `followUser`.
3. Каждый `query` возвращает только URL, метод, `params`, `body` — никакой логики.
4. Каждый запрос объявляет `providesTags`, каждая мутация — `invalidatesTags` по таблице §6.3.
5. Списки — всегда `infiniteQuery` с курсором по образцу выше (ADR 0017).
6. В компонентах мутации вызываются с `.unwrap()` внутри `try/catch`, ошибки разбираются `getApiError()`.

### 6.3 Правила инвалидации

Тег — метка данных в кэше. Запрос «предоставляет» теги, мутация «сбрасывает» теги, и все запросы с этими тегами
загружаются заново. `{ type: 'Post', id }` — конкретный объект; `'Feed'` — все ленты и сетки публикаций.

| Запрос | `providesTags` |
|---|---|
| `getMe`, `getBadges` | `Me`, `Badge` |
| `getSettings`, `getNotificationPreferences`, `getSessions` | `Settings`, `Session` |
| `getProfile(userId)`, `getProfileByUserName` | `{User, id}` |
| `getFollowers` / `getFollowing(userId)`, `getMutualFollowers` | `{Follow, userId}` |
| `getFollowRequests` | `FollowRequest` |
| `getCloseFriends`, `getFavoriteAccounts` | `CloseFriend` |
| `getBlocked`, `getRestricted`, `getMuted`, `getStoryHiddenFrom` | `Privacy` |
| `getPost(postId)`, `getPostByShortcode` | `{Post, id}` |
| `getFeed*`, `getExplore`, `getReels`, `getUserPosts`, `getUserReels`, `getUserTagged`, `getArchivedPosts`, `getHashtagPosts`, `getLocationPosts` | `Feed` |
| `getComments(postId)`, `getReplies(commentId)` | `{Comment, postId}` |
| `getSaved`, `getCollections`, `getCollectionPosts` | `Saved`, `Collection` |
| `getHashtag` | `{Hashtag, name}` |
| `getStoryTray`, `getUserStories`, `getStory`, `getStoryViewers`, `getArchivedStories` | `Story` |
| `getHighlights(userId)`, `getHighlight` | `Highlight` |
| `getChats`, `getChat` | `Chat` |
| `getMessages(chatId)` | `{Message, chatId}` |
| `getCall` | `{Call, id}` |
| `getNotifications` | `Notification` |
| `getSearchHistory(type)` | `{SearchHistory, type}` |
| `getLocations`, `getLocation` | `Location` |
| `getReports` (Admin) | `Report` |

| Мутация | `invalidatesTags` |
|---|---|
| вход, выход, регистрация, подтверждение кода, соцвход | весь кэш: `dispatch(baseApi.util.resetApiState())`, затем переход |
| `updateMe`, имя пользователя, email, аватар, ссылки | `Me`, `{User, myId}` |
| `updateSettings`, настройки уведомлений, завершение сессии | `Settings`, `Session` |
| `followUser` / `unfollowUser` | `{User, userId}`, `{Follow, userId}`, `{Follow, myId}`, `Feed`, `Story` |
| принять/отклонить запрос, удалить подписчика | `FollowRequest`, `{Follow, myId}`, `{User, myId}`, `Badge` |
| близкие друзья, избранные аккаунты | `CloseFriend`, `Feed` (избранные), `Story` (близкие) |
| блок, ограничение, скрытие, «скрыть историю от» | `Privacy`, `{User, userId}`, `Feed`, `Story`, `Chat`, `Comment` |
| `createPost` / `updatePost` / `deletePost`, архив, закрепление | `Feed`, `{Post, id}`, `{User, myId}` |
| `likePost`, `savePost` (+ снятие) | оптимистичное обновление (§6.5), затем `Saved` для сохранения |
| `createComment` / `updateComment` / `deleteComment`, закрепление, одобрение | `{Comment, postId}`, `{Post, postId}` (счётчик) |
| `likeComment` | оптимистичное обновление комментария в кэше `getComments`/`getReplies` |
| подборки | `Collection`, `Saved` |
| `createStory` / `deleteStory` | `Story`, `Highlight` |
| `likeStory`, ответы на стикеры | оптимистично в `getStory`; `Story` |
| `viewStory` | без инвалидации; кольцо в `getStoryTray` обновляется через `updateQueryData` |
| актуальное | `Highlight` |
| сообщения, реакции, редактирование, отмена | оптимистично в `{Message, chatId}`; `Chat` |
| чаты: создать, изменить, участники, принять, удалить, без звука, прочитано | `Chat`, `Badge` |
| звонки | `{Call, id}`, `{Message, chatId}` |
| `markNotificationsRead` | `Notification`, `Badge` |
| история поиска | `{SearchHistory, type}` |
| жалоба | — (тост «Спасибо, что сообщили») |
| Admin: места, жалобы, галочки, баны | `Location`, `Report`, `{User, userId}` |
| `playPost` | — |

### 6.4 Пагинация и поиск

- Все списки — `build.infiniteQuery` с курсором (образец §6.2): `fetchNextPage()` при прокрутке
  (`IntersectionObserver` у последнего элемента), `hasNextPage`, данные — `data.pages.flatMap(p => p.items)`.
- Сообщения чата: `getMessages` — новые сначала; на экране список переворачивается, подгрузка — при прокрутке вверх.
- Поиск: `build.query` с аргументом-строкой; ввод с задержкой ~300 мс (debounce); пустая строка — `skip: true`.
- Хранение неиспользуемых данных — по умолчанию RTK Query (60 с); `refetchOnReconnect: true` в `createApi`.

### 6.5 Оптимистичные обновления

Мгновенная реакция нужна там, где пользователь ждёт её в Instagram: лайки (постов, комментариев, историй),
сохранение, отправка сообщения, реакции на сообщения. Мутация меняет кэш до ответа сервера и откатывает при ошибке:

```ts
likePost: build.mutation<void, { postId: string; liked: boolean }>({
  query: ({ postId, liked }) => ({ url: `/posts/${postId}/like`, method: liked ? 'PUT' : 'DELETE' }),
  async onQueryStarted({ postId, liked }, { dispatch, getState, queryFulfilled }) {
    const patches = updatePostInCache(dispatch, getState, postId, (post) => {
      post.isLikedByMe = liked;
      if (post.likeCount !== null) post.likeCount += liked ? 1 : -1;   // null — число скрыто автором
    });
    try {
      await queryFulfilled;
    } catch {
      patches.forEach((patch) => patch.undo());   // сервер отказал — возвращаем как было
    }
  },
}),
```

`updatePostInCache` (`features/posts/cache.ts`, ~20 строк) применяет одно изменение ко всем местам, где пост лежит
в кэше: `getPost` и бесконечные списки с тегом `Feed` — через `postsApi.util.selectCachedArgsForQuery` и
`postsApi.util.updateQueryData`. Так лайк в ленте и на странице поста всегда совпадает.

Сообщение отправляется с `clientId`: в кэш сразу добавляется сообщение со статусом «отправляется», ответ сервера
(или событие `message:new` с тем же `clientId`) заменяет его, ошибка — помечает «Не отправлено. Повторить».

### 6.6 Реальное время → кэш RTK Query

Одно подключение Socket.IO на вкладку (`lib/realtime.ts`), создаётся после входа в `StoreProvider` и закрывается при
выходе. Каждое событие из [REALTIME.md](../api/REALTIME.md) обрабатывается **одной функцией** рядом с эндпоинтами
своей функции (`features/chat/realtime.ts`, `features/notifications/realtime.ts`):

```ts
// features/chat/realtime.ts (образец)
export function registerChatEvents(socket: Socket, dispatch: AppDispatch) {
  socket.on('message:new', ({ message }) => {
    dispatch(chatApi.util.updateQueryData('getMessages', message.chatId, (draft) => {
      const first = draft.pages[0];
      if (!first.items.some((m) => m.id === message.id)) first.items.unshift(message);
    }));
    dispatch(baseApi.util.invalidateTags(['Chat', 'Badge']));
  });
}
```

Правила: событие либо точечно меняет кэш (`updateQueryData`), либо сбрасывает тег — без своей логики «что
показывать»; эфемерные состояния (печатает, в сети, входящий звонок) — в локальном `useState`/контексте экрана,
не в Redux. После переподключения — сброс тегов `Chat`, `Message`, `Notification`, `Badge`.

## 7. Ошибки и состояния загрузки

- `getApiError(error)` (`lib/api/errors.ts`) превращает ошибку RTK Query (`FetchBaseQueryError` или
  `SerializedError`) в `{ status, code, message, details }` по формату из
  [API_CONTRACT.md](../api/API_CONTRACT.md#12-формат-ошибки-). Сетевая ошибка → `code: 'NETWORK_ERROR'`.
- Потеря сессии (`401 UNAUTHENTICATED`) обрабатывается один раз — в `baseQueryWithAuth` (§4.1).
- Формы: `showApiError(error, form)` (`lib/api/errors.ts`) — `VALIDATION_ERROR.details` у соответствующих полей, `CONFLICT` — у поля, остальное — toast.
- Остальные ошибки — toast (Sonner из shadcn/ui) с текстом по `code`.
- Автоматических повторов запросов нет; в состоянии ошибки — кнопка «Повторить» (`refetch()`).
- Состояния в компонентах: `isLoading` → skeleton; ошибка → сообщение + «Повторить»; пустой список → текст из спецификации функции;
  `isFetching` при фоновой перезагрузке не прячет уже показанные данные.

## 8. Сессия и CSRF со стороны frontend

- `fetchBaseQuery` использует `fetch`, который на том же origin по умолчанию отправляет cookie — дополнительного кода не нужно.
- Браузер сам добавляет заголовок `Origin` к изменяющим запросам; backend его проверяет. Frontend ничего не делает для CSRF.
- Frontend никогда не читает и не хранит токен сессии; `prepareHeaders` для авторизации **не используется**.

Подробно: [AUTHENTICATION.md](AUTHENTICATION.md), [SECURITY.md](SECURITY.md#csrf).

## 9. Загрузка файлов

Двухшаговая, как в контракте ([endpoints/media.md](../api/endpoints/media.md)):

1. **Загрузка** каждого файла — `uploadMedia(file, purpose, onProgress)` в `lib/api/upload.ts`. Это **единственное
   исключение** из правила «запросы только через RTK Query»: прогресс загрузки нужен на экране создания публикации, а
   `fetch` его не сообщает, поэтому функция использует `XMLHttpRequest` (тот же origin, cookie отправляется сама).
2. **Создание объекта** — обычная мутация RTK Query с `mediaIds` в JSON:

```ts
createPost: build.mutation<Post, CreatePostBody>({
  query: (body) => ({ url: '/posts', method: 'POST', body }),
  invalidatesTags: ['Feed', 'Me'],
}),
```

- До загрузки frontend проверяет тип и размер (для удобства); окончательную проверку делает backend.
- Видео остаётся в статусе `PROCESSING`; экран ждёт события `media:processed` и только потом активирует «Поделиться»
  (или публикует пост сразу со статусом `PROCESSING` — для reels, как в Instagram «Публикация обрабатывается»).
- Обрезка, фильтры, редактор историй выполняются в браузере на `<canvas>` до загрузки; на сервер уходит готовое изображение.
- Голосовые: `MediaRecorder` → Blob → `uploadMedia(blob, 'VOICE')` → `sendMessage({ type: 'VOICE', mediaIds })`.

## 10. Соответствие контракту

1. Backend — источник истины: DTO NestJS + декораторы → Swagger.
2. `npm run contract`: экспорт `docs/api/openapi.json` → генерация `apps/web/src/lib/api/schema.d.ts`.
3. Оба файла коммитятся. Изменение контракта видно в diff PR.
4. Эндпоинты RTK Query пишутся вручную, но их типы ответов — псевдонимы сгенерированных (`lib/api/types.ts`).
   Изменился DTO → `npm run typecheck` покажет все места, где frontend использует старую форму.
5. URL эндпоинтов не проверяются компилятором — их сверяет `reviewer` с API_CONTRACT.md, а e2e-сценарии
   Playwright (T5.B1) ловят ошибки в путях.
6. CI выполняет `npm run contract` и падает, если сгенерированные файлы отличаются от закоммиченных, затем `typecheck`.

Процесс изменения: [CHANGE_PROCESS.md](../development/CHANGE_PROCESS.md#изменение-api-контракта).
