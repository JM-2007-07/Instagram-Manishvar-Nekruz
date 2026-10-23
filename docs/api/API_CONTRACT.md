# API Contract — `/api/v1`

> **Статус:** ✅ структура и соглашения приняты; эндпоинты — 📝 проект нашего Swagger под каталог функций
> ([ADR 0011](../decisions/0011-instagram-parity-scope.md)). Поля DTO — **черновик**: окончательно их фиксирует Swagger
> NestJS (`docs/api/openapi.json`), который генерируется из кода.
> Открытые вопросы — `Q…` в [REQUIREMENTS.md §5](../REQUIREMENTS.md#5-открытые-вопросы); функции — `F-…` в
> [FEATURE_CATALOG.md](../product/FEATURE_CATALOG.md); исходный Swagger — `#1…#57` в [API_INVENTORY.md](API_INVENTORY.md).

Документ состоит из общих соглашений (этот файл), **эндпоинтов по модулям** ([§2](#2-эндпоинты-по-модулям)) и
событий реального времени ([REALTIME.md](REALTIME.md)).

## Легенда

| Метка | Значение |
|---|---|
| ✅ Принято | решение согласовано |
| 📝 Черновик | обоснованное предложение; может уточниться при реализации без отдельного согласования, если не меняет смысл |
| ❓ `Qn` | открытый вопрос |
| P0 / P1 / P2 | приоритет функции из каталога |

---

## 1. Общие соглашения ✅

| Тема | Правило |
|---|---|
| Базовый путь | `/api/v1`; браузер обращается на том же origin, Next.js проксирует в NestJS ([API_REQUEST_ARCHITECTURE.md](../architecture/API_REQUEST_ARCHITECTURE.md)) |
| Ресурсы | существительные во множественном числе, kebab-case: `/posts`, `/search-history` |
| Идентификаторы | UUID в пути: `/posts/{postId}`. Публикации также доступны по `shortcode` (`/posts/by-shortcode/{shortcode}`), профили — по имени (`/users/by-username/{userName}`) |
| Текущий пользователь | всегда **из сессии**; ресурсы своего аккаунта — под `/me` |
| JSON | `application/json`, поля в camelCase |
| Даты | ISO 8601 UTC (`"2026-10-20T12:00:00.000Z"`); дата рождения — `"YYYY-MM-DD"` |
| Аутентификация | HttpOnly cookie сессии ([AUTHENTICATION.md](../architecture/AUTHENTICATION.md)); `Authorization` не используется |
| CSRF | для `POST/PUT/PATCH/DELETE` backend проверяет `Origin` ([SECURITY.md](../architecture/SECURITY.md#csrf)) |
| Отношения «я ↔ объект» | идемпотентные `PUT` (поставить) и `DELETE` (снять): лайк, сохранение, подписка, блок, закрепление, архив |
| Загрузка файлов | **двухшаговая**: `POST /media` (multipart, поле `file`) → `MediaFile`; затем id файлов передаются в JSON создания поста, истории, сообщения, аватара ([endpoints/media.md](endpoints/media.md)) |
| Медиа в ответах | `url`, `thumbnailUrl` вида `/api/v1/media/{mediaId}`; доступ проверяется при каждом запросе |
| Приватность | каждая выдача фильтруется на backend: блокировки (в обе стороны), закрытые аккаунты, скрытые/ограниченные (REQUIREMENTS §4.8) |
| Регистр строк | `userName`, `email`, хэштеги — в нижнем регистре |
| Реальное время | изменения — через REST; события о них — через Socket.IO ([REALTIME.md](REALTIME.md)) |

### 1.1 Коды успешных ответов

| Ситуация | Код | Тело |
|---|---|---|
| Получение, изменение (`GET`, `PATCH`) | `200` | ресурс |
| Создание (`POST`) | `201` | созданный ресурс |
| `PUT`-отношение | `200` с новым состоянием (например, `{ "status": "PENDING" }` у подписки) или `204` | см. эндпоинт |
| `DELETE`, выход | `204` | нет |
| Принято к обработке (письмо, видео) | `202` | нет или ресурс со статусом `PROCESSING` |
| Редирект OAuth | `302` | — |

Успешный ответ **не оборачивается** в `{ data, errors, statusCode }` (P19).

### 1.2 Формат ошибки ✅

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [{ "field": "userName", "message": "userName must be 1-30 characters" }],
  "requestId": "6f1c…"
}
```

`details` — только у `VALIDATION_ERROR`. `message` — для разработчика (английский); текст для пользователя frontend
выбирает по `code`. Stack trace и SQL в ответ не попадают никогда.

| `code` | HTTP | Когда |
|---|---|---|
| `VALIDATION_ERROR` | 400 | тело/параметры не прошли валидацию |
| `BAD_REQUEST` | 400 | недопустимое действие (подписка на себя, ответ на ответ) |
| `VERIFICATION_CODE_INVALID` | 400 | неверный или просроченный код подтверждения |
| `OAUTH_FAILED` | 400 | провайдер вернул ошибку, неверный `state` |
| `UNAUTHENTICATED` | 401 | нет сессии или она истекла |
| `INVALID_CREDENTIALS` | 401 | неверный логин или пароль (без уточнения) |
| `EMAIL_NOT_VERIFIED` | 403 | вход до подтверждения email |
| `FORBIDDEN` | 403 | нет прав на действие с видимым ресурсом |
| `PRIVATE_ACCOUNT` | 403 | контент закрытого аккаунта для неподписанного |
| `CSRF_REJECTED` | 403 | изменяющий запрос с чужого или пустого `Origin` |
| `NOT_FOUND` | 404 | ресурса нет **или** он скрыт (блокировка, чужой чат) |
| `CONFLICT` | 409 | уникальность (`userName`, `email` заняты) |
| `EDIT_WINDOW_EXPIRED` | 409 | редактирование после 15 минут 📝 |
| `LIMIT_REACHED` | 409 | превышен лимит (3 закреплённых, 20 медиа, 5 ссылок…) |
| `MEDIA_NOT_READY` | 409 | файл ещё обрабатывается или с ошибкой |
| `PAYLOAD_TOO_LARGE` | 413 | файл больше лимита |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | недопустимый тип файла |
| `RATE_LIMITED` | 429 | превышен лимит частоты (`Retry-After`) |
| `INTERNAL_ERROR` | 500 | непредвиденная ошибка |

### 1.3 Пагинация ✅ ([ADR 0017](../decisions/0017-cursor-pagination.md))

Все списки — курсорные: `?cursor=<opaque>&limit=<1..50>` (по умолчанию 20) → `{ "items": [...], "nextCursor": "…" | null }`.
Курсор непрозрачный; клиент передаёт его как есть.

### 1.4 Модели ответов 📝

Черновые формы; окончательные поля — в Swagger NestJS. Модели переиспользуются всеми модулями.

```ts
type UserSummary = {
  id: string; userName: string; fullName: string; avatarUrl: string | null;
  isVerified: boolean; isPrivate: boolean;
  hasActiveStory: boolean; isCloseFriendStory: boolean;   // для кольца аватара
};

type Profile = UserSummary & {
  bio: string | null; pronouns: string | null; links: { url: string; title: string | null }[];
  postCount: number; followerCount: number; followingCount: number;
  followStatus: 'NONE' | 'FOLLOWING' | 'REQUESTED';      // мой статус подписки на него
  followsMe: boolean; isBlocked: boolean; isRestricted: boolean; isMuted: { posts: boolean; stories: boolean };
  mutualFollowers: { users: UserSummary[]; total: number };
  canViewContent: boolean;                                // false — закрытый и я не подписан
  isMe: boolean;
};

type Me = Profile & { email: string; emailVerified: boolean; birthday: string; gender: Gender | null;
  genderCustom: string | null; hasPassword: boolean; role: 'USER' | 'ADMIN' };

type MediaItem = { id: string; kind: 'IMAGE' | 'VIDEO' | 'AUDIO'; status: 'PROCESSING' | 'READY' | 'FAILED';
  url: string; thumbnailUrl: string | null; width: number | null; height: number | null; durationSec: number | null };

type Post = {
  id: string; shortcode: string; type: 'POST' | 'REEL'; status: 'PROCESSING' | 'PUBLISHED';
  author: UserSummary; collaborators: UserSummary[];
  items: { position: number; media: MediaItem; altText: string | null;
           tags: { user: UserSummary; x: number; y: number }[] }[];
  caption: string | null; location: Location | null;
  likeCount: number | null;            // null — автор скрыл или скрыто для меня
  commentCount: number; playCount: number | null;
  isLikedByMe: boolean; isSavedByMe: boolean; commentsDisabled: boolean; hideLikeCount: boolean;
  isPinned: boolean; isArchived: boolean; editedAt: string | null; publishedAt: string;
  previewComments: Comment[];          // до 2 для карточки ленты
};

type Comment = {
  id: string; postId: string; parentId: string | null; author: UserSummary; text: string;
  likeCount: number; isLikedByMe: boolean; replyCount: number; isPinned: boolean;
  isPendingApproval: boolean; editedAt: string | null; createdAt: string;
};

type Story = {
  id: string; author: UserSummary; media: MediaItem | null; sharedPost: { id: string; shortcode: string;
  previewUrl: string | null; author: UserSummary } | null; audience: 'EVERYONE' | 'CLOSE_FRIENDS';
  stickers: StorySticker[]; durationSec: number; createdAt: string; expiresAt: string;
  isViewedByMe: boolean; isLikedByMe: boolean;
  viewerCount: number | null; likeCount: number | null;   // только автору
};

type StorySticker = { id: string; type: 'MENTION' | 'LOCATION' | 'HASHTAG' | 'LINK' | 'POLL' | 'QUESTION'
  | 'SLIDER' | 'QUIZ' | 'COUNTDOWN'; x: number; y: number; width: number; height: number; rotation: number;
  data: Record<string, unknown>; myResponse: unknown | null };

type StoryTrayItem = { author: UserSummary; storyIds: string[]; hasUnseen: boolean; isCloseFriends: boolean; latestAt: string };

type Highlight = { id: string; title: string; coverUrl: string | null; storyCount: number };

type Chat = {
  id: string; type: 'DIRECT' | 'GROUP'; title: string | null; avatarUrl: string | null;
  participants: (UserSummary & { role: 'MEMBER' | 'ADMIN'; isOnline: boolean; lastActiveAt: string | null })[];
  lastMessage: Message | null; unreadCount: number; isMuted: boolean; isRequest: boolean; updatedAt: string;
};

type Message = {
  id: string; chatId: string; sender: UserSummary | null;
  type: 'TEXT' | 'MEDIA' | 'VOICE' | 'SHARE_POST' | 'SHARE_PROFILE' | 'SHARE_STORY' | 'STORY_REPLY'
      | 'STORY_REACTION' | 'CALL' | 'SYSTEM';
  text: string | null; media: MediaItem[]; replyTo: { id: string; text: string | null; senderName: string } | null;
  sharedPost: Post | null; sharedUser: UserSummary | null; story: Story | null; call: Call | null;
  reactions: { emoji: string; users: UserSummary[] }[]; editedAt: string | null; createdAt: string;
};

type Call = { id: string; chatId: string; type: 'AUDIO' | 'VIDEO'; status: 'RINGING' | 'ONGOING' | 'ENDED'
  | 'MISSED' | 'DECLINED'; initiator: UserSummary; startedAt: string; answeredAt: string | null; endedAt: string | null };

type Notification = { id: string; type: NotificationType; actors: UserSummary[]; actorCount: number;
  post: { id: string; shortcode: string; thumbnailUrl: string | null } | null; comment: { id: string; text: string } | null;
  isRead: boolean; createdAt: string };

type Location = { id: string; name: string; slug: string; city: string; state: string | null; zipCode: string | null;
  country: string; latitude: number | null; longitude: number | null };

type Hashtag = { name: string; postCount: number };

type Page<T> = { items: T[]; nextCursor: string | null };
```

---

## 2. Эндпоинты по модулям

Каждый файл — эндпоинты одного модуля backend: метод и путь, доступ, запрос, ответ, ошибки, функции, исходная операция.
Владелец модуля меняет свой файл по [CHANGE_PROCESS.md](../development/CHANGE_PROCESS.md#изменение-api-контракта); владелец общих
соглашений (§1) и [REALTIME.md](REALTIME.md) — A. Студенты: A — `JM-2007-07`, B — `nek-yt` ([план](../IMPLEMENTATION_PLAN.md#4-карточки-модулей)).

Доступ: **Public** — без сессии; **User** — вошедший; **Owner** — владелец ресурса; **Member** — участник чата;
**Admin** — роль `ADMIN`. «Видимость» — правила приватности REQUIREMENTS §4.8.

| Модуль | Файл | Функции | Владелец | Задача |
|---|---|---|---|---|
| `auth` | [endpoints/auth.md](endpoints/auth.md) | F-ACC-* | A | T1.A1 |
| `users` | [endpoints/users.md](endpoints/users.md) | F-PRF-*, F-ACC-11…14 | A | T1.A3 |
| `follows` | [endpoints/follows.md](endpoints/follows.md) | F-SOC-* | A | T1.A4 |
| `privacy` | [endpoints/privacy.md](endpoints/privacy.md) | F-PRV-* | A | T1.A5 |
| `settings` | [endpoints/settings.md](endpoints/settings.md) | F-SET-*, F-NTF-06 | A | T1.A3 |
| `media` | [endpoints/media.md](endpoints/media.md) | загрузка и раздача файлов | B | T1.B1 |
| `posts` | [endpoints/posts.md](endpoints/posts.md) | F-PST-*, F-FED-*, F-REL-*, F-INT-01, 02, 12 | B | T1.B4 |
| `comments` | [endpoints/comments.md](endpoints/comments.md) | F-INT-03…08, 13 | B | T1.B5 |
| `collections` | [endpoints/collections.md](endpoints/collections.md) | F-INT-09, 10 | A | T2.A3 |
| `tags` | [endpoints/tags.md](endpoints/tags.md) | F-TAG-*, F-SRC-04 | B | T1.B2 |
| `stories` | [endpoints/stories.md](endpoints/stories.md) | F-STR-* | B | T2.B1, T2.B2 |
| `chats` | [endpoints/chats.md](endpoints/chats.md) | F-DM-*, F-INT-11 | A | T2.A4 |
| `calls` | [endpoints/calls.md](endpoints/calls.md) | F-CAL-* | A | T4.A2 (опц.) |
| `notifications` | [endpoints/notifications.md](endpoints/notifications.md) | F-NTF-* | A | T2.A2 |
| `search` | [endpoints/search.md](endpoints/search.md) | F-SRC-01…03, F-TAG-03 | A | T1.A6 |
| `locations` | [endpoints/locations.md](endpoints/locations.md) | F-SRC-05, F-MOD-03 | B | T1.B3 |
| `admin` | [endpoints/admin.md](endpoints/admin.md) | F-PRV-11, F-MOD-* | B | T4.B4 (опц.; `DELETE /admin/users` — R) |
| служебные | `GET /health` (Public) → `{ "status": "ok" }` | Phase 0 | A | T0.2 |
| события | [REALTIME.md](REALTIME.md) | F-NTF-05, F-DM-10…12, F-CAL-* | A | T2.A1 |

---

## 3. Таблица соответствия «исходная операция → новый endpoint»

Все 57 операций исходного Swagger покрыты. `int32` id → UUID; `PageNumber`/`PageSize` → курсор (ADR 0017).

| # | Исходная операция | Новый endpoint | Что изменилось |
|---|---|---|---|
| 1 | `POST /Account/register` | `POST /auth/register` → `POST /auth/register/verify` | без `confirmPassword`; + дата рождения; подтверждение email кодом |
| 2 | `POST /Account/login` | `POST /auth/login` | вход по имени **или** email; HttpOnly-сессия вместо JWT |
| 3 | `DELETE /Account/ForgotPassword?Email` | `POST /auth/password/forgot` | `DELETE`→`POST`, данные в теле, всегда `202` |
| 4 | `DELETE /Account/ResetPassword?…` | `POST /auth/password/reset` | всё в теле; email не нужен; отзыв всех сессий |
| 5 | `PUT /Account/ChangePassword?…` | `POST /auth/password/change` | пароли в теле; отзыв остальных сессий |
| 6 | `GET /Chat/get-chats` | `GET /chats` | + папки «Основное/Запросы», курсор |
| 7 | `GET /Chat/get-chat-by-id?chatId` | `GET /chats/{chatId}` + `GET /chats/{chatId}/messages` | сообщения — отдельный список |
| 8 | `POST /Chat/create-chat?receiverUserId` | `POST /chats` `{ userIds }` | один id — личный чат (идемпотентно), несколько — группа |
| 9 | `PUT /Chat/send-message` (multipart) | `POST /media` + `POST /chats/{chatId}/messages` | `PUT`→`POST`; файл загружается отдельно |
| 10 | `DELETE /Chat/delete-message?massageId` | `DELETE /chats/{chatId}/messages/{messageId}` | «отменить отправку» у всех; опечатка исправлена |
| 11 | `DELETE /Chat/delete-chat?chatId` | `DELETE /chats/{chatId}` | удаляет переписку только у себя (Q16) |
| 12 | `GET /FollowingRelationShip/get-subscribers?UserId` | `GET /users/{userId}/followers` | курсор, поиск по списку |
| 13 | `GET /FollowingRelationShip/get-subscriptions?UserId` | `GET /users/{userId}/following` | то же |
| 14 | `POST …/add-following-relation-ship?followingUserId` | `PUT /users/{userId}/follow` | ответ `ACCEPTED` или `PENDING` (закрытый аккаунт) |
| 15 | `DELETE …/delete-following-relation-ship?followingUserId` | `DELETE /users/{userId}/follow` | также отменяет запрос |
| 16 | `GET /Location/get-Locations` | `GET /locations` | camelCase, курсор, поиск `q` |
| 17 | `GET /Location/get-Location-by-id?id` | `GET /locations/{locationId}` | id в пути |
| 18 | `POST /Location/add-Location` | `POST /locations` (Admin) | права определены |
| 19 | `PUT /Location/update-Location` | `PATCH /locations/{locationId}` (Admin) | частичное изменение |
| 20 | `DELETE /Location/delete-Location?id` | `DELETE /locations/{locationId}` (Admin) | id в пути |
| 21 | `GET /Post/get-posts?UserId&Title&Content&…` | `GET /explore`, `GET /users/{userId}/posts`, `GET /search?q=` | разделено по назначению |
| 22 | `GET /Post/get-reels` | `GET /reels` | — |
| 23 | `GET /Post/get-post-by-id?id` | `GET /posts/{postId}` (+ `/posts/by-shortcode/{shortcode}`) | id в пути |
| 24 | `GET /Post/get-my-posts` | `GET /users/{myId}/posts` | один путь для своих и чужих |
| 25 | `GET /Post/get-following-post?UserId&…` | `GET /feed` (+ `/feed/following`, `/feed/favorites`) | пользователь из сессии |
| 26 | `POST /Post/add-post` (multipart `Images`) | `POST /media` × N + `POST /posts` | фото и видео, до 20 📝; отметки, место, alt |
| 27 | `DELETE /Post/delete-post?id` | `DELETE /posts/{postId}` | только автор |
| 28 | `POST /Post/like-post?postId` | `PUT` / `DELETE /posts/{postId}/like` | явная пара |
| 29 | `POST /Post/view-post?postId` | `POST /posts/{postId}/plays` | воспроизведения видео (Q14) |
| 30 | `POST /Post/add-comment` | `POST /posts/{postId}/comments` `{ text, parentId? }` | + ответы |
| 31 | `DELETE /Post/delete-comment?commentId` | `DELETE /comments/{commentId}` | автор комментария или поста |
| 32 | `POST /Post/add-post-favorite` | `PUT` / `DELETE /posts/{postId}/save` | «сохранить» как в Instagram |
| 33 | `GET /Story/get-stories` | `GET /stories/tray` | лента кругов с `hasUnseen` |
| 34 | `GET /Story/get-user-stories/{userId}` | `GET /users/{userId}/stories` | — |
| 35 | `GET /Story/get-my-stories` | `GET /users/{myId}/stories`, `GET /me/archive/stories` | + архив |
| 36 | `POST /Story/LikeStory?storyId` | `PUT` / `DELETE /stories/{storyId}/like` | — |
| 37 | `GET /Story/GetStoryById?id` | `GET /stories/{storyId}` | без обёртки |
| 38 | `POST /Story/AddStories?PostId` + `Image` | `POST /media` + `POST /stories` `{ mediaId | sharedPostId, stickers, audience }` | + стикеры, аудитория |
| 39 | `DELETE /Story/DeleteStory?id` | `DELETE /stories/{storyId}` | `204` |
| 40 | `POST /Story/add-story-view?StoryId` | `PUT /stories/{storyId}/view` | идемпотентно |
| 41 | `GET /User/get-users?UserName&Email&…` | `GET /search/users?q=` | поиск по email удалён (P9) |
| 42 | `POST /User/add-search-history?Text` | `POST /me/search-history` `{ type: "QUERY", query }` | единая история (4 типа) |
| 43 | `GET /User/get-search-histories` | `GET /me/search-history?type=QUERY` | — |
| 44 | `DELETE /User/delete-search-history?id` | `DELETE /me/search-history/{entryId}` | — |
| 45 | `DELETE /User/delete-search-histories` | `DELETE /me/search-history?type=QUERY` | — |
| 46 | `POST /User/add-user-search-history?UserSearchId` | `POST /me/search-history` `{ type: "USER", userId }` | — |
| 47 | `GET /User/get-user-search-histories` | `GET /me/search-history?type=USER` | — |
| 48 | `DELETE /User/delete-user-search-history?id` | `DELETE /me/search-history/{entryId}` | — |
| 49 | `DELETE /User/delete-user-search-histories` | `DELETE /me/search-history?type=USER` | — |
| 50 | `DELETE /User/delete-user?userId` | `DELETE /me` (свой, отложенно) и `DELETE /admin/users/{userId}` (Admin) | разделено |
| 51 | `GET /UserProfile/get-user-profile-by-id?id` | `GET /users/{userId}` (+ `/users/by-username/{userName}`) | — |
| 52 | `GET /UserProfile/get-is-follow-user-profile-by-id?…` | поле `followStatus` в `Profile` | объединено |
| 53 | `GET /UserProfile/get-my-profile` | `GET /me` | — |
| 54 | `PUT /UserProfile/update-user-profile` | `PATCH /me` | частичное изменение, больше полей |
| 55 | `GET /UserProfile/get-post-favorites` | `GET /me/saved` | + подборки |
| 56 | `PUT /UserProfile/update-user-image-profile` | `POST /media` + `PUT /me/avatar` `{ mediaId }` | загрузка отдельно |
| 57 | `DELETE /UserProfile/delete-user-image-profile` | `DELETE /me/avatar` | — |

---

## 4. Исправленные проблемы исходного контракта

| Проблема | Решение |
|---|---|
| P1 нет схем ответов | модели §1.4; окончательные — DTO NestJS + Swagger |
| P2 нет ошибок | единый формат §1.2; каждый эндпоинт перечисляет свои коды |
| P3 JWT в JS, нет logout | HttpOnly-сессия, `POST /auth/logout`, список сессий |
| P4 пароли в URL | секреты только в теле |
| P5 неверные методы | `POST` — действия, `PATCH` — частичные изменения, `PUT`/`DELETE` — отношения |
| P6 нет отмены | пары `PUT`/`DELETE` |
| P7 пользователь в параметрах | только из сессии; `/me/...` |
| P8 права не описаны | колонка «Доступ» в каждом эндпоинте; [SECURITY.md](../architecture/SECURITY.md#авторизация) |
| P9 поиск по email | удалён |
| P10, P11 стиль, опечатка | единые соглашения §1 |
| P12 нет операций | каталог функций и файлы эндпоинтов |
| P13 пагинация | курсорная (ADR 0017) |
| P14 reels | `Post.type = REEL`, обработка видео (ADR 0016) |
| P15 stories | `mediaId` или `sharedPostId`, стикеры, 24 ч + архив |
| P16 gender | 4 значения (Q9) |
| P17 locations | места у публикаций и историй, страницы мест (Q20) |
| P18 строковые id | UUID + `shortcode` |
| P19 обёртка ответа | убрана |
| P20 файлы без ограничений | лимиты в [SECURITY.md](../architecture/SECURITY.md#загрузка-файлов) |
| P21 confirmPassword | проверяется формой |
| P22 отправка писем | `MAIL_DRIVER=log` (журнал API) или `smtp` (`SMTP_HOST/PORT/USER/PASSWORD`, `MAIL_FROM`); сервис в продакшене — Q23 |
| P23 лишние content types | только `application/json` и `multipart/form-data` (`POST /media`) |
| P24 семантика чатов | `POST /chats` идемпотентен для личных; удаление — у себя |
| P25 раздача медиа | `GET /media/{mediaId}` с проверкой прав |

## 5. Как меняется контракт

Любое изменение путей, методов, полей или кодов — по [CHANGE_PROCESS.md](../development/CHANGE_PROCESS.md#изменение-api-контракта):
сначала файл модуля в `endpoints/` (и этот файл, если меняются соглашения или модели), затем DTO NestJS, затем
`npm run contract` — всё в одном изменении.
