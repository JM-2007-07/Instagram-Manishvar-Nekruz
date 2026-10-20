# Архитектура запросов frontend → backend

> Статус: ✅ направление согласовано (same-origin прокси, TanStack Query, типы из Swagger).
> Фрагменты кода ниже — **иллюстрации** подхода, а не готовая реализация.

## 1. Цели

- Один способ делать запросы — без конкурирующих клиентов.
- Типы запросов и ответов берутся из Swagger backend, а не пишутся вручную.
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
// apps/web/next.config.ts (иллюстрация)
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
| Браузер (Client Components) | `/api/v1` (относительный) | константа в `lib/api/client.ts` |
| Сервер Next.js (Server Components, `next.config.ts`) | `${API_INTERNAL_URL}/api/v1` | `apps/web/.env.local`, проверяется при старте |

Переменной `NEXT_PUBLIC_API_URL` нет: браузеру не нужен адрес NestJS.

## 4. API-клиент

Используются два небольших инструмента одного автора (проект openapi-ts):

- **`openapi-typescript`** (dev) — генерирует `lib/api/schema.d.ts` из `docs/api/openapi.json`;
- **`openapi-fetch`** (runtime, очень маленькая обёртка над `fetch`) — типизирует вызовы по этим типам.

```ts
// lib/api/client.ts — браузер (иллюстрация)
import createClient from 'openapi-fetch';
import type { paths } from './schema';
export const api = createClient<paths>({ baseUrl: '/api/v1' });

// использование: путь, параметры и ответ проверяются TypeScript
const { data, error } = await api.GET('/posts/{postId}', { params: { path: { postId } } });
```

```ts
// lib/api/server.ts — Server Components (иллюстрация)
import 'server-only';
import { cookies } from 'next/headers';
export async function serverApi() {
  const cookieHeader = (await cookies()).toString();
  return createClient<paths>({
    baseUrl: `${env.API_INTERNAL_URL}/api/v1`,
    headers: { cookie: cookieHeader },
    cache: 'no-store',            // персональные данные не кэшируются Next.js
  });
}
```

Почему не писать свою обёртку над `fetch`: пришлось бы вручную описывать типы каждого endpoint или писать
сложные generic-типы. `openapi-fetch` даёт это готовым и почти не добавляет кода.

Компоненты **не вызывают** `api` напрямую — только через функции и хуки в `features/<name>/api.ts`.

## 5. Server Components: получение данных

- Используют `serverApi()` только для **чтения** (`GET`).
- Пересылают cookie пользователя; NestJS проверяет сессию как обычно.
- Не устанавливают cookie (в Server Components это невозможно) — продление сессии происходит на
  запросах браузера через прокси.
- Результат передаётся в Client Component как `initialData` для хука TanStack Query с тем же ключом.
- `401` в layout `(main)` → `redirect('/login')`; `404` → `notFound()`.

## 6. Client Components: TanStack Query

### 6.1 Почему TanStack Query

| Вариант | Оценка |
|---|---|
| `fetch` + `useEffect` + `useState` | для каждого экрана вручную: загрузка, ошибки, повторные запросы, обновление после изменений. Много однотипного кода и ошибок (гонки запросов) |
| RTK Query | хорош, но требует Redux store, который в проекте больше ни для чего не нужен; больше концепций для объяснения |
| **TanStack Query** ✅ | кэш серверных данных, состояния загрузки/ошибки, `useInfiniteQuery` для лент, инвалидация после мутаций; не требует глобального store |

Глобального клиентского store (Redux, Zustand) нет: серверные данные — в TanStack Query, локальное
состояние UI — в `useState`. Если появится реальная потребность — отдельное решение.

**Server Actions для изменений не используются**: все изменения идут одним путём — мутации TanStack Query →
`/api/v1`. Так NestJS остаётся единственной точкой бизнес-логики, а в коде один способ изменять данные.

### 6.2 Ключи запросов

Ключи задаются фабриками в `features/<name>/api.ts`, чтобы не опечататься при инвалидации:

```ts
export const postKeys = {
  all: ['posts'] as const,
  detail: (id: string) => ['posts', id] as const,
  comments: (id: string) => ['posts', id, 'comments'] as const,
};
```

### 6.3 Правила инвалидации

| Мутация | Инвалидировать |
|---|---|
| вход, выход, регистрация | весь кэш (`queryClient.clear()`), затем переход |
| `PATCH /me`, аватар | `['me']`, `['users', myId]` |
| подписка/отписка | `['users', userId]`, `['users', userId, 'followers']`, `['feed']`, `['stories', 'feed']` |
| создание/удаление поста | `['feed']`, `['posts']`, `['users', authorId, 'posts']`, `['reels']` |
| лайк/избранное | оптимистичное обновление `['posts', id]`; затем `['me', 'favorites']` для избранного |
| комментарий | `['posts', id, 'comments']`, `['posts', id]` (счётчик) |
| сторис: создание/удаление | `['stories']` |
| сообщение | `['chats', chatId, 'messages']`, `['chats']` |
| история поиска | `['search-history', 'queries']` или `['search-history', 'users']` |

Оптимистичные обновления — только для лайков и избранного (мгновенная реакция заметна пользователю).
Остальное — обычная инвалидация после ответа.

### 6.4 Пагинация, поиск, фильтры

- Ленты, комментарии, сообщения — `useInfiniteQuery` с `page`; следующая страница есть, если `page * limit < total`.
- Поиск — `useQuery` с ключом, включающим строку поиска; ввод с задержкой ~300 мс (debounce).
- Чат без real-time — `refetchInterval` (например, 5 с) только на открытом экране чата (Q19).

## 7. Ошибки и состояния загрузки

- `lib/api/errors.ts` превращает ответ в `ApiError { status, code, message, details }` по формату из
  [API_CONTRACT.md](../api/API_CONTRACT.md#12-формат-ошибки-).
- Глобально (в `QueryClient`): `401 UNAUTHENTICATED` → очистить кэш и перейти на `/login`.
- Формы: `VALIDATION_ERROR.details` показываются у соответствующих полей; `CONFLICT` — сообщение у поля.
- Остальные ошибки — toast (компонент Sonner из shadcn/ui) с текстом по `code`.
- Повторные запросы: только для `GET` и только для сетевых ошибок/5xx (не для 4xx).
- Загрузка: `loading.tsx` для серверных страниц; skeleton-компоненты для клиентских списков.
- Пустые состояния описаны в спецификации каждой функции.

## 8. Сессия и CSRF со стороны frontend

- `fetch` на том же origin по умолчанию отправляет cookie (`credentials: 'same-origin'`) — дополнительного кода не нужно.
- Браузер сам добавляет заголовок `Origin` к изменяющим запросам; backend его проверяет. Frontend ничего не делает для CSRF.
- Frontend никогда не читает и не хранит токен сессии.

Подробно: [AUTHENTICATION.md](AUTHENTICATION.md), [SECURITY.md](SECURITY.md#csrf).

## 9. Загрузка файлов

- `FormData` с полями из контракта (`file` или `files`); `Content-Type` выставляет браузер.
- До отправки frontend проверяет тип и размер (для удобства); окончательную проверку делает backend.
- Индикатор прогресса `fetch` не поддерживает. Если он понадобится для видео — отдельная функция на
  `XMLHttpRequest` только для загрузки (решение при реализации reels).

## 10. Соответствие контракту

1. Backend — источник истины: DTO NestJS + декораторы → Swagger.
2. `pnpm contract`: экспорт `docs/api/openapi.json` → генерация `apps/web/src/lib/api/schema.d.ts`.
3. Оба файла коммитятся. Изменение контракта видно в diff PR.
4. CI выполняет `pnpm contract` и падает, если сгенерированные файлы отличаются от закоммиченных,
   затем `pnpm typecheck` — frontend не соберётся, если вызывает несуществующий endpoint или поле.

Процесс изменения: [CHANGE_PROCESS.md](../development/CHANGE_PROCESS.md#изменение-api-контракта).
