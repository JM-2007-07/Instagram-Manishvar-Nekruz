# Эндпоинты: `stories`

> Модуль `stories` · функции F-STR-* · спецификация [features/stories.md](../../features/stories.md).

## Истории

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F / # |
|---|---|---|---|---|---|
| `GET /stories/tray` | User | — | `StoryTrayItem[]` — свои первыми, затем с непросмотренными | — | F-STR-01 / #33 |
| `GET /users/{userId}/stories` | User (видимость, аудитория) | — | `Story[]` активные | 403, 404 | F-STR-07 / #34, #35 |
| `GET /stories/{storyId}` | User (видимость) | — | `Story` | 404 (истекла — кроме автора) | F-STR-07 / #37 |
| `POST /stories` | User | `{ mediaId? , sharedPostId?, audience?, durationSec?, stickers?: { type, x, y, width, height, rotation, data }[] }` | `201 Story` | 400, 403 (чужой пост запрещено), 409 `MEDIA_NOT_READY` | F-STR-02…06 / #38 |
| `DELETE /stories/{storyId}` | Owner | — | `204` | 404 | F-STR-13 / #39 |
| `PUT /stories/{storyId}/view` | User | — | `204` (автор — без записи) | 404 | F-STR-11 / #40 |
| `PUT` / `DELETE /stories/{storyId}/like` | User | — | `204` | 404 | F-STR-10 / #36 |
| `GET /stories/{storyId}/viewers` | Owner | `?cursor` | `Page<UserSummary & { liked, reaction? }>` | 404 | F-STR-11 |
| `POST /stories/{storyId}/reply` | User | `{ text }` | `201 Message` (в личном чате с автором) | 403 (настройки сообщений), 404 | F-STR-08 |
| `POST /stories/{storyId}/reactions` | User | `{ emoji }` | `201 Message` | 404 | F-STR-09 |
| `PUT /stories/{storyId}/stickers/{stickerId}/response` | User | `{ value }` — вариант опроса, ответ на вопрос, значение шкалы, ответ викторины | `204` | 400, 404 | F-STR-04 |
| `GET /stories/{storyId}/stickers/{stickerId}/responses` | Owner | `?cursor` | `Page<{ user, value }>` + итоги | 404 | F-STR-04 |
| `GET /me/archive/stories` | User | `?cursor` | `Page<Story>` (включая истёкшие) | — | F-STR-12 |

## Актуальное

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F |
|---|---|---|---|---|---|
| `GET /users/{userId}/highlights` | User (видимость) | — | `Highlight[]` | 403, 404 | F-STR-20 |
| `GET /highlights/{highlightId}` | User (видимость) | — | `{ ...Highlight, stories: Story[] }` | 404 | F-STR-20 |
| `POST /highlights` | User | `{ title, storyIds, coverMediaId? }` | `201 Highlight` | 400 (не свои истории) | F-STR-20 |
| `PATCH /highlights/{highlightId}` | Owner | `{ title?, coverMediaId? }` | `Highlight` | 404 | F-STR-20 |
| `PUT /highlights/{highlightId}/stories` | Owner | `{ storyIds }` — новый состав и порядок | `Highlight` | 400, 404 | F-STR-20 |
| `DELETE /highlights/{highlightId}` | Owner | — | `204` | 404 | F-STR-20 |

Правила:
- Видимость истории: автор не заблокирован; аккаунт открыт или я подписан; `audience = CLOSE_FRIENDS` — только если я в
  списке близких друзей автора; меня нет в «Скрыть историю от»; история не истекла (кроме автора и «Актуального»).
- Опубликованная история не редактируется (Q30); в «Актуальном» видны и истёкшие истории.
- `sharedPostId` — только видимый открытый пост, автор которого разрешил `allowStoryResharing`.
- Ответы и реакции создают сообщения в Direct (модуль `chats`); упоминания в стикерах — уведомления `MENTION_STORY`.
