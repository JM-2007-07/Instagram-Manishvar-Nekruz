# 0010. RTK Query для запросов frontend

- Статус: Принято
- Дата: 2026-10-21
- Заменяет: [0005](0005-tanstack-query.md) (TanStack Query + openapi-fetch)

## Контекст

Команда решила использовать **RTK Query** (Redux Toolkit) для всех запросов из браузера, с максимально простым
и понятным кодом. Приложений ещё нет, поэтому замена ничего не стоит. Нужно сохранить принципы ADR 0004 и 0006:
same-origin прокси, HttpOnly-сессия, типы из Swagger backend, один способ запросов.

Проверено по пакету `@reduxjs/toolkit` 2.13.0 (актуальная версия на 2026-10-21): есть `createApi`,
`injectEndpoints`, теги (`providesTags`/`invalidatesTags`), `build.infiniteQuery` с хуками
`use…InfiniteQuery` (`fetchNextPage`, `hasNextPage`), `updateQueryData` для оптимистичных обновлений,
`pollingInterval` и `skipPollingIfUnfocused`.

## Решение

1. **Один API-слой RTK Query:** `lib/api/base-api.ts` — `createApi` с `fetchBaseQuery({ baseUrl: '/api/v1' })`,
   обёрнутым в `baseQueryWithAuth` (на `401` — сброс кэша и переход на `/login`). Эндпоинты добавляются в
   каждой функции через `baseApi.injectEndpoints` в `features/<name>/api.ts`.
2. **Store только для RTK Query:** `lib/store.ts` (`makeStore`) + `StoreProvider` (Client Component, создаёт
   store один раз). Других slice'ов нет, пока не появится обоснованная потребность (новый ADR).
3. **Типы — из Swagger NestJS:** `openapi-typescript` генерирует `schema.d.ts`; в `lib/api/types.ts` —
   короткие понятные псевдонимы (`Post`, `Profile`, `Page<T>`). Эндпоинты пишутся **вручную** с этими типами.
4. **Кэш:** инвалидация тегами по единой таблице (API_REQUEST_ARCHITECTURE.md §6).
5. **Server Components** не загружают данные страниц: только проверка сессии в layout `(main)` через небольшой
   `serverFetch` (`lib/api/server.ts`). Данные страниц загружает RTK Query в Client Components.
6. `openapi-fetch` и TanStack Query **не используются** (исключение — поиск аккаунтов, [ADR 0019](0019-tanstack-query-user-search.md)).

## Рассмотренные альтернативы

- **TanStack Query (ADR 0005)** — не требует Redux store, но команда предпочла RTK Query.
- **`@rtk-query/codegen-openapi`** (генерация всех эндпоинтов и хуков из Swagger) — всегда в синхронизации,
  но порождает большой файл с длинными именами (`useGetApiV1PostsByPostIdQuery`) и требует отдельной настройки
  тегов; студенту сложнее объяснить. Ручные эндпоинты с сгенерированными типами — короче и понятнее, а
  расхождение с контрактом ловит `typecheck`.
- **Загрузка данных страниц в Server Components с передачей в кэш RTK Query** — быстрее первый показ, но
  требует гидратации кэша и двух путей загрузки одних и тех же данных. Все страницы приложения закрыты входом
  (SEO не нужен), поэтому выбран один путь — клиентский. Пересмотреть, если первый показ станет заметно медленным.

## Последствия

- Зависимости frontend: `@reduxjs/toolkit`, `react-redux` (ставятся в T0.3); `openapi-typescript` — dev.
- Один способ запросов из браузера: хуки RTK Query из `features/<name>/api.ts`.
- Первый показ страниц — со skeleton, данные приходят после загрузки JS.
- Обновлены: API_REQUEST_ARCHITECTURE.md, RENDERING_STRATEGY.md, CODING_CONVENTIONS.md, AGENTS.md, агент `frontend-dev`.
