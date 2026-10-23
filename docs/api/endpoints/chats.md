# Эндпоинты: `chats`

> Модуль `chats` · функции F-DM-*, F-INT-11 · спецификация [features/chat.md](../../features/chat.md) ·
> события реального времени — [REALTIME.md](../REALTIME.md). Чужой чат всегда `404`.

## Переписки

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F / # |
|---|---|---|---|---|---|
| `GET /chats` | User | `?folder=PRIMARY\|REQUESTS&cursor` — по последнему сообщению | `Page<Chat>` | — | F-DM-01, 13 / #6 |
| `POST /chats` | User | `{ userIds: string[], title? }` — один id: личный чат (вернуть существующий); несколько: группа | `201 Chat` / `200 Chat` | 400, 403 (нельзя писать по настройкам/блокировка → 404), 409 `LIMIT_REACHED` (250 📝) | F-DM-02, 03 / #8 |
| `GET /chats/{chatId}` | Member | — | `Chat` | 404 | F-DM-01 / #7 |
| `PATCH /chats/{chatId}` | Member (группа; название и фото — любой участник 📝) | `{ title?, avatarMediaId? }` | `Chat` + системное сообщение | 404 | F-DM-03 |
| `POST /chats/{chatId}/participants` | Member группы | `{ userIds }` | `Chat` + системное сообщение | 404, 409 | F-DM-03 |
| `DELETE /chats/{chatId}/participants/{userId}` | Admin группы или сам (выйти) | — | `204` + системное сообщение | 403, 404 | F-DM-03 |
| `PUT` / `DELETE /chats/{chatId}/participants/{userId}/admin` | Admin группы | — | `204` | 403 | F-DM-03 |
| `POST /chats/{chatId}/accept` | Member (запрос) | — | `204` — чат переходит в «Основное» | 404 | F-DM-13 |
| `DELETE /chats/{chatId}` | Member | — | `204` — переписка скрыта **у себя** (`clearedAt`); группа — также выход | 404 | F-DM-14 / #11 |
| `PUT` / `DELETE /chats/{chatId}/mute` | Member | `{ until? }` | `204` | 404 | F-DM-14 |
| `POST /chats/{chatId}/read` | Member | `{ messageId }` | `204` + событие `chat:read` | 404 | F-DM-10 |

## Сообщения

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F / # |
|---|---|---|---|---|---|
| `GET /chats/{chatId}/messages` | Member | `?cursor` — новые сначала | `Page<Message>` | 404 | F-DM-04 / #7 |
| `POST /chats/{chatId}/messages` | Member | `{ type: "TEXT" \| "MEDIA" \| "VOICE" \| "SHARE_POST" \| "SHARE_PROFILE" \| "SHARE_STORY", text?, mediaIds?, replyToId?, sharedPostId?, sharedUserId?, storyId?, clientId }` | `201 Message` + событие `message:new` | 400, 404, 409 `MEDIA_NOT_READY`, 429 | F-DM-04…06 / #9 |
| `PATCH /chats/{chatId}/messages/{messageId}` | автор | `{ text }` | `Message` + `message:updated` | 409 `EDIT_WINDOW_EXPIRED` (15 мин 📝) | F-DM-08 |
| `DELETE /chats/{chatId}/messages/{messageId}` | автор | — | `204` — «отменить отправку» у всех + `message:unsent` | 404 | F-DM-09 / #10 |
| `PUT /chats/{chatId}/messages/{messageId}/reaction` | Member | `{ emoji }` | `204` + `message:reaction` | 400, 404 | F-DM-07 |
| `DELETE /chats/{chatId}/messages/{messageId}/reaction` | Member | — | `204` | 404 | F-DM-07 |
| `POST /messages/share` | User | `{ userIds?, chatIds?, postId? \| userId? \| storyId?, text? }` | `201 { messages: Message[] }` — по сообщению в каждый чат | 400, 404 | F-INT-11 |

Правила:
- `clientId` — id, созданный клиентом, чтобы не задвоить сообщение при повторной отправке и сопоставить
  оптимистичное сообщение с ответом сервера.
- Сообщение от пользователя, на которого получатель не подписан, создаёт чат со статусом `REQUEST` у получателя;
  до принятия отправитель не видит «прочитано».
- У каждого участника в `Chat.participants` есть `lastReadMessageId` — до какого сообщения он прочитал чат
  (для «Просмотрено» сразу при открытии, без ожидания `chat:read`); пока чат у участника в запросах, другим — `null`.
- Голосовое: `type = VOICE`, один `mediaId` с `kind = AUDIO`, до 60 с 📝.
- Ссылки в тексте получают предпросмотр (заголовок, картинка) — P2, собирается backend'ом с ограничением времени.
- Блокировка делает чат недоступным для отправки в обе стороны; `404`.
