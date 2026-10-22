# Эндпоинты: `comments`

> Модуль `comments` · функции F-INT-03…08, 13 · спецификация [post-interactions.md](../../features/post-interactions.md).

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F / # |
|---|---|---|---|---|---|
| `GET /posts/{postId}/comments` | User (видимость поста) | `?cursor&sort=TOP\|NEWEST` — закреплённые первыми, затем по `sort` | `Page<Comment>` (только верхнего уровня) | 403, 404 | F-INT-03, 13 |
| `GET /comments/{commentId}/replies` | User (видимость) | `?cursor` — от старых к новым | `Page<Comment>` | 404 | F-INT-04 |
| `POST /posts/{postId}/comments` | User (видимость, `commentsFrom`) | `{ text, parentId? }` | `201 Comment` | 400 (ответ на ответ), 403 (комментарии отключены / нельзя по настройкам), 404, 429 | F-INT-03, 04 / #30 |
| `PATCH /comments/{commentId}` | автор | `{ text }` | `Comment` (`editedAt`) | 409 `EDIT_WINDOW_EXPIRED` (15 мин 📝) | F-INT-07 |
| `DELETE /comments/{commentId}` | автор комментария или поста | — | `204` (вместе с ответами) | 403, 404 | F-INT-08 / #31 |
| `PUT` / `DELETE /comments/{commentId}/like` | User | — | `204` | 404 | F-INT-05 |
| `GET /comments/{commentId}/likes` | User | `?cursor` | `Page<UserSummary>` | 404 | F-INT-05 |
| `PUT` / `DELETE /comments/{commentId}/pin` | автор поста | — | `204` | 400 (ответ нельзя), 409 `LIMIT_REACHED` (3 📝) | F-INT-06 |
| `POST /comments/{commentId}/approve` | автор поста | — | `204` — показать комментарий ограниченного пользователя | 404 | F-PRV-03 |

Правила:
- Ответ (`parentId`) — только на комментарий верхнего уровня; в тексте ответа frontend подставляет `@имя`.
- Комментарии заблокированных и `isPendingApproval` (кроме автора комментария и автора поста) не выдаются.
- Уведомления: `COMMENT` автору поста, `COMMENT_REPLY` автору родительского, `COMMENT_LIKE`, `MENTION_COMMENT`.
