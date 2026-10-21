# API Contract — `/api/v1`

> **Статус:** согласовано направление (REST под `/api/v1`, cookie-сессии, полное покрытие исходного Swagger).
> Пути и методы ниже — **предложенный контракт**. Поля DTO — **черновик**: окончательно их фиксирует
> Swagger нашего NestJS backend (`docs/api/openapi.json`), который появится в Phase 0.
> Открытые вопросы имеют номера `Q…` и собраны в [REQUIREMENTS.md](../REQUIREMENTS.md#5-открытые-вопросы).

Исходный контракт: [API_INVENTORY.md](API_INVENTORY.md) (операции `#1…#57`, проблемы `P1…P25`).

## Легенда

| Метка | Значение |
|---|---|
| ✅ Принято | решение согласовано |
| 📝 Черновик | разумное предложение с обоснованием; может уточниться при реализации без отдельного согласования, если не меняет смысл |
| ❓ `Qn` | открытый вопрос; до ответа реализуется вариант «по умолчанию», указанный в REQUIREMENTS.md, или не реализуется |

---

## 1. Общие соглашения ✅

| Тема | Правило |
|---|---|
| Базовый путь | `/api/v1`. Браузер обращается к нему на том же origin, что и сайт; Next.js проксирует запрос в NestJS (см. [API_REQUEST_ARCHITECTURE.md](../architecture/API_REQUEST_ARCHITECTURE.md)) |
| Ресурсы | существительные во множественном числе, kebab-case: `/posts`, `/search-history` |
| Идентификаторы | UUID в пути: `/posts/{postId}`. Никаких id в query для операций над одним ресурсом |
| Текущий пользователь | всегда берётся **из сессии**. Ресурсы «моего» аккаунта — под `/me` |
| JSON | `application/json`, поля в camelCase. `text/json` и `application/*+json` не поддерживаются (P23) |
| Даты | ISO 8601 в UTC: `"2026-10-20T12:00:00.000Z"` |
| Аутентификация | HttpOnly cookie сессии. Заголовок `Authorization` не используется (P3) |
| CSRF | для `POST/PUT/PATCH/DELETE` backend проверяет заголовок `Origin` (см. [SECURITY.md](../architecture/SECURITY.md#csrf)) |
| Отношения «я ↔ ресурс» | идемпотентные `PUT` (поставить) и `DELETE` (снять): лайк, избранное, подписка, просмотр (P6) |
| Загрузка файлов | `multipart/form-data`; файлы в поле `file` (один) или `files` (несколько) |
| Медиа | в ответах — `url` вида `/api/v1/media/{mediaId}`; доступ проверяется при каждом запросе (P25) |
| Регистр строк | `userName` и `email` сравниваются без учёта регистра и хранятся в нижнем регистре 📝 |

### 1.1 Коды успешных ответов ✅

| Ситуация | Код | Тело |
|---|---|---|
| Получение, изменение (`GET`, `PATCH`) | `200` | ресурс |
| Создание (`POST`) | `201` | созданный ресурс |
| `PUT`-отношение, `DELETE`, выход | `204` | нет |
| Запрос сброса пароля | `202` | нет (ответ одинаков для существующего и несуществующего email) |

Успешный ответ **не оборачивается** в `{ data, errors, statusCode }` (P19): HTTP-статус уже несёт эту информацию,
а типы на frontend становятся проще.

### 1.2 Формат ошибки ✅

Все ошибки имеют один формат (P2):

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [{ "field": "userName", "message": "userName must be 3-30 characters" }],
  "requestId": "6f1c…"
}
```

`details` есть только у `VALIDATION_ERROR`. `message` — для разработчика (на английском); текст для пользователя
frontend выбирает по `code`. Внутренние детали (stack trace, SQL) в ответ не попадают никогда.

| `code` | HTTP | Когда |
|---|---|---|
| `VALIDATION_ERROR` | 400 | тело/параметры не прошли валидацию |
| `BAD_REQUEST` | 400 | запрос корректен по форме, но недопустим (например, подписка на самого себя) |
| `UNAUTHENTICATED` | 401 | нет сессии или она истекла |
| `INVALID_CREDENTIALS` | 401 | неверный логин или пароль (без уточнения, что именно) |
| `FORBIDDEN` | 403 | нет прав на действие с ресурсом, о существовании которого пользователь может знать |
| `CSRF_REJECTED` | 403 | изменяющий запрос пришёл с чужого или отсутствующего `Origin` |
| `NOT_FOUND` | 404 | ресурса нет **или** он скрыт от пользователя (чужой чат возвращает 404, а не 403) |
| `CONFLICT` | 409 | конфликт уникальности (`userName`/`email` заняты) |
| `PAYLOAD_TOO_LARGE` | 413 | файл больше лимита |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | недопустимый тип файла |
| `RATE_LIMITED` | 429 | превышен лимит частоты (заголовок `Retry-After`) |
| `INTERNAL_ERROR` | 500 | непредвиденная ошибка |

### 1.3 Пагинация ✅

Единый постраничный формат для всех списков (P13):

- Query: `page` (с 1, по умолчанию `1`), `limit` (по умолчанию `20`, максимум `50`).
- Ответ:

```json
{ "items": [], "page": 1, "limit": 20, "total": 134 }
```

Списки, которые в Swagger были без пагинации (подписчики, чаты, мои посты, история поиска), тоже получают её —
иначе ответы растут без ограничений. Для сообщений чата постраничный режим имеет известный недостаток
(новые сообщения сдвигают страницы) — ❓ Q29.

### 1.4 Черновые модели ответов 📝

Это минимальные формы, обоснованные исходными DTO и потребностями экранов. Окончательные поля — в Swagger NestJS.

```ts
// Основано на ViewerDto (userName, name) и GetStoryDto.userAvatar из исходного Swagger
type UserSummary = { id: string; userName: string; fullName: string; avatarUrl: string | null };

type MediaItem = { id: string; url: string; kind: 'IMAGE' | 'VIDEO'; mimeType: string };

type Profile = UserSummary & {
  about: string | null;
  gender: Gender | null;              // значения — Q9
  postCount: number; followerCount: number; followingCount: number;
  isFollowedByMe: boolean;            // заменяет #52 get-is-follow-user-profile-by-id
  isMe: boolean;
};

type Post = {
  id: string; author: UserSummary;
  title: string | null; content: string | null;   // поля из #26 (Title, Content)
  media: MediaItem[];                             // порядок = порядок загрузки
  isReel: boolean;                                // Q10
  likeCount: number; commentCount: number; viewCount: number;
  isLikedByMe: boolean; isFavoritedByMe: boolean;
  createdAt: string;
};

type Comment = { id: string; postId: string; author: UserSummary; text: string; createdAt: string };

type Story = {
  id: string; author: UserSummary;
  media: MediaItem | null; sharedPost: { id: string; previewUrl: string | null } | null;  // #38: Image или PostId
  createdAt: string; expiresAt: string;
  viewCount: number | null; likeCount: number | null;  // как viewerDto.viewCount/viewLike; видит только автор
  isLikedByMe: boolean; isViewedByMe: boolean;
};

type Chat = { id: string; otherUser: UserSummary; lastMessage: Message | null; updatedAt: string };

type Message = { id: string; chatId: string; sender: UserSummary; text: string | null; attachment: MediaItem | null; createdAt: string };

type Location = { id: string; city: string; state: string; zipCode: string; country: string };  // из AddLocationDto

type TextSearchEntry = { id: string; text: string; createdAt: string };
type UserSearchEntry = { id: string; user: UserSummary; createdAt: string };
```

---

## 2. Эндпоинты

Колонка «Доступ»: **Public** — без сессии; **User** — нужна сессия; **Owner** — только владелец ресурса;
**Member** — только участник чата; **Admin** — ❓ Q6. Колонка `#` — номер исходной операции.

### 2.1 Auth (`auth` module)

| Метод и путь | Доступ | Запрос | Ответ | # |
|---|---|---|---|---|
| `POST /auth/register` | Public | `{ userName, fullName, email, password }` | `201` + cookie (Q4) + `UserSummary` | 1 |
| `POST /auth/login` | Public | `{ userName, password }` (вход по email — Q3) | `200` + cookie + `UserSummary` | 2 |
| `POST /auth/logout` | User | — | `204`, cookie удаляется, сессия отзывается | новый (P3) |
| `POST /auth/password/forgot` | Public | `{ email }` | `202` всегда (без раскрытия наличия аккаунта) | 3 |
| `POST /auth/password/reset` | Public | `{ token, newPassword }` | `204`; все сессии пользователя отзываются | 4 |
| `POST /auth/password/change` | User | `{ currentPassword, newPassword }` | `204`; остальные сессии отзываются | 5 |

`confirmPassword` проверяется только формой на frontend (P21). Пароли и токены передаются **только в теле** (P4).

### 2.2 Me и профили (`users` module)

| Метод и путь | Доступ | Запрос | Ответ | # |
|---|---|---|---|---|
| `GET /me` | User | — | `Profile` (+ `email`) — также служит проверкой сессии | 53 |
| `PATCH /me` | User | `{ about?, gender? }` (+ `fullName?` — Q8) | `Profile` | 54 |
| `PUT /me/avatar` | User | multipart `file` | `Profile` | 56 |
| `DELETE /me/avatar` | User | — | `204` | 57 |
| `DELETE /me` | User | `{ password }` | `204`, все сессии отзываются (Q7) | 50 (свой аккаунт) |
| `GET /users` | User | `?search=&page=&limit=` — поиск по `userName` и `fullName` | `Page<UserSummary>` | 41 |
| `GET /users/{userId}` | User | — | `Profile` | 51, 52 |
| `GET /users/by-username/{userName}` | User | — | `Profile` | новый — ❓ Q5 |
| `DELETE /admin/users/{userId}` | Admin | — | `204` | 50 (чужой аккаунт) — ❓ Q6 |

Поиск по `email` удалён (P9). #52 больше не нужен отдельно: поле `isFollowedByMe` в `Profile`.

### 2.3 Follows (`follows` module)

| Метод и путь | Доступ | Запрос | Ответ | # |
|---|---|---|---|---|
| `PUT /users/{userId}/follow` | User | — | `204`; нельзя подписаться на себя (`BAD_REQUEST`) | 14 |
| `DELETE /users/{userId}/follow` | User | — | `204` | 15 |
| `GET /users/{userId}/followers` | User | `?page&limit` | `Page<UserSummary>` | 12 |
| `GET /users/{userId}/following` | User | `?page&limit` | `Page<UserSummary>` | 13 |

### 2.4 Posts, reels, лента и взаимодействия (`posts` module)

| Метод и путь | Доступ | Запрос | Ответ | # |
|---|---|---|---|---|
| `GET /feed` | User | `?page&limit` — посты тех, на кого я подписан, и мои | `Page<Post>` | 25 |
| `GET /posts` | User | `?search=&page&limit` — все посты, новые сначала; `search` по `title`/`content` (Q28) | `Page<Post>` | 21 |
| `GET /users/{userId}/posts` | User | `?page&limit` | `Page<Post>` | 24, 21 (`UserId`) |
| `GET /reels` | User | `?page&limit` | `Page<Post>` (только `isReel`) | 22 — Q10 |
| `GET /posts/{postId}` | User | — | `Post` | 23 |
| `POST /posts` | User | multipart: `title?`, `content?`, `files` (1–10) | `201 Post` | 26 |
| `DELETE /posts/{postId}` | Owner | — | `204` | 27 |
| `PUT /posts/{postId}/like` | User | — | `204` | 28 |
| `DELETE /posts/{postId}/like` | User | — | `204` | новый (P6) |
| `PUT /posts/{postId}/view` | User | — | `204`; повтор не увеличивает счётчик (Q14) | 29 |
| `GET /posts/{postId}/comments` | User | `?page&limit` | `Page<Comment>` | новый (P12) |
| `POST /posts/{postId}/comments` | User | `{ text }` | `201 Comment` | 30 |
| `DELETE /comments/{commentId}` | автор комментария (+ автор поста — Q13) | — | `204` | 31 |
| `PUT /posts/{postId}/favorite` | User | — | `204` | 32 |
| `DELETE /posts/{postId}/favorite` | User | — | `204` | новый (P6) |
| `GET /me/favorites` | User | `?page&limit` | `Page<Post>` | 55 |

### 2.5 Stories (`stories` module)

| Метод и путь | Доступ | Запрос | Ответ | # |
|---|---|---|---|---|
| `GET /stories/feed` | User | — активные сторис моих подписок и мои, сгруппированные по автору | `{ author: UserSummary; stories: Story[]; hasUnviewed: boolean }[]` | 33 |
| `GET /users/{userId}/stories` | User | — активные сторис пользователя | `Story[]` | 34, 35 (`userId` = мой id) |
| `GET /stories/{storyId}` | User | — | `Story` | 37 |
| `POST /stories` | User | multipart: **ровно одно** из `file` или `postId` (Q12) | `201 Story` | 38 |
| `DELETE /stories/{storyId}` | Owner | — | `204` | 39 |
| `PUT /stories/{storyId}/view` | User | — | `204`; автор свои просмотры не создаёт | 40 |
| `PUT /stories/{storyId}/like` | User | — | `204` | 36 |
| `DELETE /stories/{storyId}/like` | User | — | `204` | новый (P6) |
| `GET /stories/{storyId}/viewers` | Owner | `?page&limit` | `Page<UserSummary & { liked: boolean }>` | новый (по смыслу `viewerDto`) |

Истёкшие сторис (после `expiresAt`) не возвращаются ни одним endpoint. Архив своих истёкших сторис для автора — ❓ Q11.

### 2.6 Chats (`chats` module)

| Метод и путь | Доступ | Запрос | Ответ | # |
|---|---|---|---|---|
| `GET /chats` | User | `?page&limit` — мои чаты, по `updatedAt` | `Page<Chat>` | 6 |
| `POST /chats` | User | `{ userId }` | `201 Chat` или `200 Chat`, если чат с этим пользователем уже есть (P24) | 8 |
| `GET /chats/{chatId}` | Member | — | `Chat` | 7 |
| `DELETE /chats/{chatId}` | Member | — | `204` — семантика Q16 | 11 |
| `GET /chats/{chatId}/messages` | Member | `?page&limit`, новые сначала (Q29) | `Page<Message>` | 7 (сообщения) / новый |
| `POST /chats/{chatId}/messages` | Member | multipart: `text?`, `file?` — хотя бы одно | `201 Message` | 9 |
| `DELETE /chats/{chatId}/messages/{messageId}` | автор сообщения | — | `204` (Q16) | 10 |

Чужой чат возвращает `404`, а не `403`, — чтобы не раскрывать его существование.

### 2.7 Search history (`search-history` module)

| Метод и путь | Доступ | Запрос | Ответ | # |
|---|---|---|---|---|
| `GET /me/search-history/queries` | User | `?page&limit` | `Page<TextSearchEntry>` | 43 |
| `POST /me/search-history/queries` | User | `{ text }` | `201 TextSearchEntry` | 42 |
| `DELETE /me/search-history/queries/{entryId}` | Owner | — | `204` | 44 |
| `DELETE /me/search-history/queries` | User | — | `204` (очистить всё) | 45 |
| `GET /me/search-history/users` | User | `?page&limit` | `Page<UserSearchEntry>` | 47 |
| `POST /me/search-history/users` | User | `{ userId }` | `201 UserSearchEntry` | 46 |
| `DELETE /me/search-history/users/{entryId}` | Owner | — | `204` | 48 |
| `DELETE /me/search-history/users` | User | — | `204` | 49 |

📝 Повторный поиск того же текста/пользователя не создаёт дубликат, а поднимает запись наверх.

### 2.8 Locations (`locations` module)

| Метод и путь | Доступ | Запрос | Ответ | # |
|---|---|---|---|---|
| `GET /locations` | User | `?city&state&zipCode&country&page&limit` | `Page<Location>` | 16 |
| `GET /locations/{locationId}` | User | — | `Location` | 17 |
| `POST /locations` | Admin (Q6, Q20) | `{ city, state, zipCode, country }` | `201 Location` | 18 |
| `PATCH /locations/{locationId}` | Admin (Q6, Q20) | `{ city?, state?, zipCode?, country? }` | `Location` | 19 |
| `DELETE /locations/{locationId}` | Admin (Q6, Q20) | — | `204` | 20 |

`locationId` переехал из тела (#19 `UpdateLocationDto.locationId`) в путь.

### 2.9 Media и служебные (`media`, `health`)

| Метод и путь | Доступ | Ответ | # |
|---|---|---|---|
| `GET /media/{mediaId}` | User + проверка доступа к владельцу медиа (вложение чата — только участникам) | файл (`200`, корректный `Content-Type`, `Cache-Control: private`) | новый (P25) |
| `GET /health` | Public | `{ status: "ok" }` | новый (Phase 0) |

### 2.10 Уведомления — не согласовано ❓ Q21

В исходном Swagger уведомлений нет. Эндпоинты **не проектируются** до ответа на Q21.
Заготовка архитектуры — в [features/notifications.md](../features/notifications.md).

---

## 3. Таблица соответствия «исходная операция → новый endpoint»

Все 57 операций исходного Swagger покрыты. `int32` id заменены на UUID (см. [DATABASE_DECISIONS.md](../database/DATABASE_DECISIONS.md)).

| # | Исходная операция | Новый endpoint | Что изменилось |
|---|---|---|---|
| 1 | `POST /Account/register` | `POST /auth/register` | без `confirmPassword`; ответ ставит cookie (Q4) |
| 2 | `POST /Account/login` | `POST /auth/login` | вместо JWT — HttpOnly cookie сессии |
| 3 | `DELETE /Account/ForgotPassword?Email` | `POST /auth/password/forgot` | `DELETE`→`POST`, email в теле, всегда `202` |
| 4 | `DELETE /Account/ResetPassword?Token&Email&Password&ConfirmPassword` | `POST /auth/password/reset` | всё в теле; email не нужен — токен однозначен; отзыв всех сессий |
| 5 | `PUT /Account/ChangePassword?OldPassword&Password&ConfirmPassword` | `POST /auth/password/change` | пароли в теле; отзыв остальных сессий |
| 6 | `GET /Chat/get-chats` | `GET /chats` | + пагинация |
| 7 | `GET /Chat/get-chat-by-id?chatId` | `GET /chats/{chatId}` + `GET /chats/{chatId}/messages` | сообщения — отдельный постраничный список |
| 8 | `POST /Chat/create-chat?receiverUserId` | `POST /chats` `{ userId }` | идемпотентно: существующий чат возвращается |
| 9 | `PUT /Chat/send-message` (multipart) | `POST /chats/{chatId}/messages` | `PUT`→`POST`; `ChatId` в пути; поля `text`, `file` |
| 10 | `DELETE /Chat/delete-message?massageId` | `DELETE /chats/{chatId}/messages/{messageId}` | исправлена опечатка; id в пути |
| 11 | `DELETE /Chat/delete-chat?chatId` | `DELETE /chats/{chatId}` | семантика — Q16 |
| 12 | `GET /FollowingRelationShip/get-subscribers?UserId` | `GET /users/{userId}/followers` | + пагинация |
| 13 | `GET /FollowingRelationShip/get-subscriptions?UserId` | `GET /users/{userId}/following` | + пагинация |
| 14 | `POST /FollowingRelationShip/add-following-relation-ship?followingUserId` | `PUT /users/{userId}/follow` | идемпотентный `PUT` |
| 15 | `DELETE /FollowingRelationShip/delete-following-relation-ship?followingUserId` | `DELETE /users/{userId}/follow` | id в пути |
| 16 | `GET /Location/get-Locations` | `GET /locations` | параметры в camelCase, `page`/`limit` |
| 17 | `GET /Location/get-Location-by-id?id` | `GET /locations/{locationId}` | id в пути |
| 18 | `POST /Location/add-Location` | `POST /locations` | права — Q6/Q20 |
| 19 | `PUT /Location/update-Location` | `PATCH /locations/{locationId}` | частичное изменение, id в пути |
| 20 | `DELETE /Location/delete-Location?id` | `DELETE /locations/{locationId}` | id в пути |
| 21 | `GET /Post/get-posts?UserId&Title&Content&…` | `GET /posts?search=` и `GET /users/{userId}/posts` | `Title`+`Content` → один `search`; фильтр по автору — вложенный ресурс |
| 22 | `GET /Post/get-reels` | `GET /reels` | определение reel — Q10 |
| 23 | `GET /Post/get-post-by-id?id` | `GET /posts/{postId}` | id в пути |
| 24 | `GET /Post/get-my-posts` | `GET /users/{myId}/posts` | один путь для своих и чужих постов; + пагинация |
| 25 | `GET /Post/get-following-post?UserId&…` | `GET /feed` | пользователь из сессии (P7) |
| 26 | `POST /Post/add-post` (multipart `Images`) | `POST /posts` (multipart `files`) | поле `files`; видео — Q10 |
| 27 | `DELETE /Post/delete-post?id` | `DELETE /posts/{postId}` | только автор |
| 28 | `POST /Post/like-post?postId` | `PUT` / `DELETE /posts/{postId}/like` | явная пара вместо неясного переключателя |
| 29 | `POST /Post/view-post?postId` | `PUT /posts/{postId}/view` | идемпотентно (Q14) |
| 30 | `POST /Post/add-comment` `{ comment, postId }` | `POST /posts/{postId}/comments` `{ text }` | `postId` в пути |
| 31 | `DELETE /Post/delete-comment?commentId` | `DELETE /comments/{commentId}` | права — Q13 |
| 32 | `POST /Post/add-post-favorite` `{ postId }` | `PUT` / `DELETE /posts/{postId}/favorite` | добавлено снятие |
| 33 | `GET /Story/get-stories` | `GET /stories/feed` | группировка по автору |
| 34 | `GET /Story/get-user-stories/{userId}` | `GET /users/{userId}/stories` | — |
| 35 | `GET /Story/get-my-stories` | `GET /users/{myId}/stories` | один путь для своих и чужих |
| 36 | `POST /Story/LikeStory?storyId` | `PUT` / `DELETE /stories/{storyId}/like` | добавлено снятие |
| 37 | `GET /Story/GetStoryById?id` | `GET /stories/{storyId}` | без обёртки ``Response`1`` |
| 38 | `POST /Story/AddStories?PostId` + `Image` | `POST /stories` (`file` **или** `postId`) | ровно одно из двух (P15) |
| 39 | `DELETE /Story/DeleteStory?id` | `DELETE /stories/{storyId}` | `204` вместо `Response<bool>` |
| 40 | `POST /Story/add-story-view?StoryId` | `PUT /stories/{storyId}/view` | идемпотентно |
| 41 | `GET /User/get-users?UserName&Email&…` | `GET /users?search=` | поиск по email удалён (P9) |
| 42 | `POST /User/add-search-history?Text` | `POST /me/search-history/queries` `{ text }` | текст в теле |
| 43 | `GET /User/get-search-histories` | `GET /me/search-history/queries` | + пагинация |
| 44 | `DELETE /User/delete-search-history?id` | `DELETE /me/search-history/queries/{entryId}` | id в пути |
| 45 | `DELETE /User/delete-search-histories` | `DELETE /me/search-history/queries` | — |
| 46 | `POST /User/add-user-search-history?UserSearchId` | `POST /me/search-history/users` `{ userId }` | id в теле |
| 47 | `GET /User/get-user-search-histories` | `GET /me/search-history/users` | + пагинация |
| 48 | `DELETE /User/delete-user-search-history?id` | `DELETE /me/search-history/users/{entryId}` | id в пути |
| 49 | `DELETE /User/delete-user-search-histories` | `DELETE /me/search-history/users` | — |
| 50 | `DELETE /User/delete-user?userId` | `DELETE /me` и `DELETE /admin/users/{userId}` | разделено: свой аккаунт / администратор (Q6, Q7) |
| 51 | `GET /UserProfile/get-user-profile-by-id?id` | `GET /users/{userId}` | — |
| 52 | `GET /UserProfile/get-is-follow-user-profile-by-id?followingUserId` | поле `isFollowedByMe` в `GET /users/{userId}` | объединено, лишний запрос не нужен |
| 53 | `GET /UserProfile/get-my-profile` | `GET /me` | — |
| 54 | `PUT /UserProfile/update-user-profile` | `PATCH /me` | частичное изменение |
| 55 | `GET /UserProfile/get-post-favorites` | `GET /me/favorites` | — |
| 56 | `PUT /UserProfile/update-user-image-profile` (`imageFile`) | `PUT /me/avatar` (`file`) | единое имя поля |
| 57 | `DELETE /UserProfile/delete-user-image-profile` | `DELETE /me/avatar` | — |

### Новые операции (нет в исходном Swagger)

| Endpoint | Зачем |
|---|---|
| `POST /auth/logout` | без выхода нельзя завершить сессию (P3) |
| `DELETE /posts/{postId}/like`, `DELETE /posts/{postId}/favorite`, `DELETE /stories/{storyId}/like` | отмена действий (P6) |
| `GET /posts/{postId}/comments` | список комментариев с пагинацией (P12) |
| `GET /chats/{chatId}/messages` | список сообщений с пагинацией (P12) |
| `GET /stories/{storyId}/viewers` | список зрителей — развитие `viewerDto` |
| `GET /media/{mediaId}` | раздача файлов с проверкой прав (P25) |
| `GET /health` | проверка работоспособности в Phase 0 |
| `GET /users/by-username/{userName}` | ❓ Q5 — только если профили адресуются по `userName` |

---

## 4. Исправленные проблемы исходного контракта

| Проблема | Решение |
|---|---|
| P1 нет схем ответов | черновые модели (раздел 1.4); окончательные — DTO NestJS + Swagger |
| P2 нет ошибок | единый формат ошибки (1.2); каждый endpoint документирует свои коды в Swagger |
| P3 JWT в JS, нет logout | HttpOnly-сессия + `POST /auth/logout` |
| P4 пароли в URL | все секреты только в теле запроса |
| P5 неверные методы | `POST` для действий, `PATCH` для частичных изменений, `PUT`/`DELETE` для отношений |
| P6 нет отмены действий | пары `PUT`/`DELETE` |
| P7 пользователь в параметрах | только из сессии; `/me/...` |
| P8 права не описаны | колонка «Доступ» в каждой таблице; правила — в [SECURITY.md](../architecture/SECURITY.md#авторизация) |
| P9 поиск по email | удалён |
| P10, P11 стиль, опечатка | единые соглашения (раздел 1) |
| P12 нет операций | добавлены необходимые (см. «Новые операции»); прочее — открытые вопросы |
| P13 пагинация | единый формат (1.3) |
| P14 reels | Q10; по умолчанию: reel = пост с одним видео |
| P15 stories | `file` **или** `postId`; срок жизни 24 ч (Q11) |
| P16 gender | Q9; до ответа поле необязательное |
| P17 locations | Q20; до ответа — независимый справочник |
| P18 строковые id | UUID для всех сущностей |
| P19 обёртка ответа | убрана |
| P20 файлы без ограничений | лимиты в [SECURITY.md](../architecture/SECURITY.md#загрузка-файлов) |
| P21 confirmPassword | проверяется формой |
| P22 отправка писем | в разработке — ссылка в лог; продакшен — Q23 |
| P23 лишние content types | только `application/json` и `multipart/form-data` |
| P24 семантика чатов | `POST /chats` идемпотентен; удаление — Q16 |
| P25 раздача медиа | `GET /media/{mediaId}` с проверкой прав |

## 5. Как меняется контракт

Любое изменение путей, методов, полей или кодов ошибок — по процессу
[CHANGE_PROCESS.md](../development/CHANGE_PROCESS.md#изменение-api-контракта): сначала этот документ,
затем DTO NestJS, затем `npm run contract` (экспорт Swagger + генерация типов frontend), всё — в одном PR.
