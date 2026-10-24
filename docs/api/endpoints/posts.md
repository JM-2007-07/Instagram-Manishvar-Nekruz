# Эндпоинты: `posts`

> Модуль `posts` · функции F-PST-*, F-FED-*, F-REL-*, F-INT-01, 02, 11, 12 · спецификации [posts.md](../../features/posts.md),
> [post-interactions.md](../../features/post-interactions.md). Комментарии — [comments.md](comments.md), сохранение — [collections.md](collections.md).

## Публикации

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F / # |
|---|---|---|---|---|---|
| `POST /posts` | User | `{ type: "POST" \| "REEL", items: { mediaId, altText?, tags?: { userId, x, y }[] }[], caption?, locationId?, collaboratorIds?, hideLikeCount?, commentsDisabled?, cropAspect? }` | `201 Post` (`status: PROCESSING`, пока видео обрабатывается) | 400, 409 `LIMIT_REACHED` / `MEDIA_NOT_READY`, 429 | F-PST-01…11, F-REL-01 / #26 |
| `GET /posts/{postId}` | User (видимость) | — | `Post` | 403 `PRIVATE_ACCOUNT`, 404 | F-PST-14 / #23 |
| `GET /posts/by-shortcode/{shortcode}` | User (видимость) | — | `Post` | 403, 404 | F-PST-20 |
| `PATCH /posts/{postId}` | Owner | `{ caption?, locationId?, items?: { position, altText?, tags? }[], hideLikeCount?, commentsDisabled? }` | `Post` (`editedAt`) | 400, 403, 404 | F-PST-15 |
| `DELETE /posts/{postId}` | Owner | — | `204` | 403, 404 | F-PST-16 / #27 |
| `PUT` / `DELETE /posts/{postId}/archive` | Owner | — | `204` | 403, 404 | F-PST-17 |
| `PUT` / `DELETE /posts/{postId}/pin` | Owner | — | `204` | 409 `LIMIT_REACHED` (3 📝) | F-PRF-09 |
| `POST /posts/{postId}/collaborators/accept` (P2) | приглашённый | — | `204` | 404 | F-PST-08 |
| `DELETE /posts/{postId}/collaborators/me` (P2) | соавтор | — | `204` — отклонить/выйти | 404 | F-PST-08 |

## Ленты и списки

| Метод и путь | Доступ | Запрос | Ответ | F / # |
|---|---|---|---|---|
| `GET /feed` | User | `?cursor` | `Page<Post \| { type: "CAUGHT_UP" } \| { type: "SUGGESTED_USERS", users }>` | F-FED-01, 02, 04 / #25 |
| `GET /feed/following` | User | `?cursor` — строго по времени | `Page<Post>` | F-FED-03 |
| `GET /feed/favorites` | User | `?cursor` | `Page<Post>` | F-FED-03 |
| `GET /explore` | User | `?cursor` | `Page<Post>` (посты и reels вперемешку) | F-SRC-01 / #21 |
| `GET /reels` | User | `?cursor` | `Page<Post>` (`type = REEL`) | F-REL-02 / #22 |
| `GET /users/{userId}/posts` | User (видимость) | `?cursor` — закреплённые первыми; и фото, и reels (как `postCount`) | `Page<Post>` | F-PRF-08 / #21, #24 |
| `GET /users/{userId}/reels` | User (видимость) | `?cursor` — только reels | `Page<Post>` | F-PRF-07 |
| `GET /users/{userId}/tagged` | User (видимость) | `?cursor` | `Page<Post>` | F-PRF-07 |
| `GET /me/archive/posts` | User | `?cursor` | `Page<Post>` | F-PST-17 |

## Взаимодействия

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F / # |
|---|---|---|---|---|---|
| `PUT` / `DELETE /posts/{postId}/like` | User (видимость) | — | `204` | 404 | F-INT-01 / #28 |
| `GET /posts/{postId}/likes` | User (видимость) | `?q&cursor` | `Page<UserSummary & { followStatus }>` | 403 (автор скрыл число лайков — видит только автор) | F-INT-02 |
| `POST /posts/{postId}/plays` | User (видимость) | — | `204` — воспроизведение видео/reel (≤ 1 в час 📝 на пользователя) | 404 | F-INT-12 / #29 |

Поделиться публикацией в Direct — `POST /messages/share` ([chats.md](chats.md)); в истории — `POST /stories` с `sharedPostId`.

Правила:
- Видимость: автор не заблокирован в обе стороны; открытый аккаунт или я подписан; не в архиве (кроме автора).
- Подпись разбирается на `#хэштеги` и `@упоминания` при создании и редактировании ([tags.md](tags.md)); упомянутые и
  отмеченные получают уведомления с учётом их настроек `mentionsFrom` / `tagsFrom`.
- Публикация с видео становится `PUBLISHED` после обработки всех файлов; автор получает событие `post:published`.
- `GET /feed`: посты подписок (кроме скрытых через mute) за последние дни, новые сначала, «Избранное» выше;
  после них — элемент `CAUGHT_UP`, затем более старые посты (ADR 0011).
