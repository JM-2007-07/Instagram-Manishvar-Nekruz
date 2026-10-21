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

Переменной `NEXT_PUBLIC_API_URL` нет: браузеру не нужен адрес NestJS.

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
    window.location.assign('/login');
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  tagTypes: ['Me', 'User', 'Follow', 'Post', 'Feed', 'Comment', 'Favorite',
             'Story', 'Chat', 'Message', 'SearchHistory', 'Location'],
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
export type Page<T> = { items: T[]; page: number; limit: number; total: number };
export type ApiErrorBody = Schemas['ApiErrorDto'];
```

Типы **не пишутся вручную** по памяти: псевдоним ссылается на сгенерированный тип. Если DTO переименовали —
`npm run typecheck` покажет все места.

## 5. Server Components

Server Components **не загружают данные страниц** (ADR 0010). Они делают только то, что нельзя сделать на клиенте:

| Где | Что | Как |
|---|---|---|
| layout `(main)` | проверка сессии до показа приложения | `serverFetch('/me')` с cookie пользователя; `401` → `redirect('/login')` |
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

    getFeed: build.infiniteQuery<Page<Post>, void, number>({
      infiniteQueryOptions: {
        initialPageParam: 1,
        getNextPageParam: (lastPage) =>
          lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
      },
      query: ({ pageParam }) => ({ url: '/feed', params: { page: pageParam, limit: 20 } }),
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
2. Имена: запрос — `getX`, `listX` (бесконечный список — тоже `getX`, хук `useGetXInfiniteQuery`), изменение —
   глагол: `createPost`, `deletePost`, `likePost`, `followUser`.
3. Каждый `query` возвращает только URL и метод/тело — никакой логики.
4. Каждый запрос объявляет `providesTags`, каждая мутация — `invalidatesTags` по таблице §6.3.
5. В компонентах мутации вызываются с `.unwrap()` внутри `try/catch`, ошибки разбираются `getApiError()`.

### 6.3 Правила инвалидации

Тег — метка данных в кэше. Запрос «предоставляет» теги, мутация «сбрасывает» теги, и все запросы с этими тегами
загружаются заново. `{ type: 'Post', id }` — конкретный пост; `'Feed'` — весь список.

| Запрос | `providesTags` |
|---|---|
| `getMe` | `Me` |
| `getProfile(userId)` | `{User, id}` |
| `getFollowers` / `getFollowing(userId)` | `{Follow, userId}` |
| `getPost(postId)` | `{Post, id}` |
| `getFeed`, `getExplore`, `getUserPosts`, `getReels` | `Feed` |
| `getComments(postId)` | `{Comment, postId}` |
| `getFavorites` | `Favorite` |
| `getStoriesFeed`, `getUserStories`, `getStory` | `Story` |
| `getChats` | `Chat` |
| `getMessages(chatId)` | `{Message, chatId}` |
| `getTextHistory` / `getUserHistory` | `{SearchHistory, 'queries'}` / `{SearchHistory, 'users'}` |
| `getLocations` | `Location` |

| Мутация | `invalidatesTags` |
|---|---|
| вход, выход, регистрация | — весь кэш: `dispatch(baseApi.util.resetApiState())`, затем переход |
| `updateMe`, аватар | `Me`, `{User, myId}` |
| `followUser` / `unfollowUser` | `{User, userId}`, `{Follow, userId}`, `{Follow, myId}`, `Feed`, `Story` |
| `createPost` / `deletePost` | `Feed`, `{Post, id}` (удаление), `{User, myId}` (счётчик) |
| `likePost`, `favoritePost` (+ снятие) | оптимистичное обновление (§6.5), затем `Favorite` для избранного |
| `createComment` / `deleteComment` | `{Comment, postId}`, `{Post, postId}` (счётчик) |
| `createStory` / `deleteStory` | `Story` |
| `likeStory`, `viewStory` | `Story` (просмотр — без инвалидации, только запись) |
| `sendMessage` / `deleteMessage` | `{Message, chatId}`, `Chat` |
| `createChat` / `deleteChat` | `Chat` |
| история поиска | соответствующий `{SearchHistory, …}` |
| локации (Admin) | `Location` |
| `viewPost` | — (не влияет на то, что видит сам пользователь) |

### 6.4 Пагинация, поиск, опрос

- Ленты, комментарии, сообщения, списки подписчиков — `build.infiniteQuery` (образец в §6.2):
  `fetchNextPage()` при прокрутке, `hasNextPage` — есть ли ещё страницы, данные — `data.pages`.
- Сообщения чата: новые сначала; при сдвиге страниц из-за новых сообщений дубли убираются по `id` при отображении (Q29).
- Поиск: обычный `build.query` с аргументом-строкой; ввод с задержкой ~300 мс (debounce) перед запросом;
  пустая строка — `skip: true`.
- Чат без real-time (Q19): `useGetMessagesInfiniteQuery(chatId, { pollingInterval: 5000, skipPollingIfUnfocused: true })` —
  опрос только на открытом экране чата и только когда вкладка активна.
- Хранение неиспользуемых данных — по умолчанию RTK Query (60 с); `refetchOnReconnect: true` в `createApi`.

### 6.5 Оптимистичные обновления — только лайки и избранное

Пользователь должен видеть сердце сразу, а не через полсекунды. Для этого мутация меняет кэш до ответа сервера
и откатывает изменение при ошибке:

```ts
likePost: build.mutation<void, { postId: string; liked: boolean }>({
  query: ({ postId, liked }) => ({ url: `/posts/${postId}/like`, method: liked ? 'PUT' : 'DELETE' }),
  async onQueryStarted({ postId, liked }, { dispatch, getState, queryFulfilled }) {
    const patches = updatePostInCache(dispatch, getState, postId, (post) => {
      post.isLikedByMe = liked;
      post.likeCount += liked ? 1 : -1;
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
в кэше: `getPost` и бесконечные списки (`getFeed`, `getExplore`, `getUserPosts`, `getReels`) — через
`postsApi.util.selectCachedArgsForQuery` и `postsApi.util.updateQueryData`. Так лайк в ленте и на странице поста
всегда совпадает. Для всех остальных мутаций — только инвалидация тегов.

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

```ts
createPost: build.mutation<Post, FormData>({
  query: (formData) => ({ url: '/posts', method: 'POST', body: formData }),
  invalidatesTags: ['Feed'],
}),
```

- Тело — `FormData` с полями из контракта (`file` или `files`); `Content-Type` с границей выставляет браузер — вручную не задаётся.
- До отправки frontend проверяет тип и размер (для удобства); окончательную проверку делает backend.
- Индикатор прогресса `fetch` не поддерживает. Если он понадобится для видео — отдельная функция на
  `XMLHttpRequest` только для загрузки (решение при реализации reels, T3.5).

## 10. Соответствие контракту

1. Backend — источник истины: DTO NestJS + декораторы → Swagger.
2. `npm run contract`: экспорт `docs/api/openapi.json` → генерация `apps/web/src/lib/api/schema.d.ts`.
3. Оба файла коммитятся. Изменение контракта видно в diff PR.
4. Эндпоинты RTK Query пишутся вручную, но их типы ответов — псевдонимы сгенерированных (`lib/api/types.ts`).
   Изменился DTO → `npm run typecheck` покажет все места, где frontend использует старую форму.
5. URL эндпоинтов не проверяются компилятором — их сверяет `reviewer` с API_CONTRACT.md, а e2e-сценарии
   Playwright (T5.2) ловят ошибки в путях.
6. CI выполняет `npm run contract` и падает, если сгенерированные файлы отличаются от закоммиченных, затем `typecheck`.

Процесс изменения: [CHANGE_PROCESS.md](../development/CHANGE_PROCESS.md#изменение-api-контракта).
