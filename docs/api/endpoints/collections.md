# Эндпоинты: `collections`

> Модуль `collections` · функции F-INT-09, 10 · спецификация [post-interactions.md](../../features/post-interactions.md). Всё — только владельцу.

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F / # |
|---|---|---|---|---|---|
| `PUT` / `DELETE /posts/{postId}/save` | User (видимость) | — | `204`; удаление убирает пост и из всех подборок | 404 | F-INT-09 / #32 |
| `GET /me/saved` | User | `?cursor` — недавно сохранённые первыми | `Page<Post>` | — | F-INT-09 / #55 |
| `GET /me/collections` | User | — | `{ id, name, coverUrl, postCount }[]` | — | F-INT-10 |
| `POST /me/collections` | User | `{ name, postIds? }` | `201 Collection` | 400 | F-INT-10 |
| `PATCH /me/collections/{collectionId}` | Owner | `{ name?, coverPostId? }` | `Collection` | 404 | F-INT-10 |
| `DELETE /me/collections/{collectionId}` | Owner | — | `204` (посты остаются в «Сохранённом») | 404 | F-INT-10 |
| `GET /me/collections/{collectionId}/posts` | Owner | `?cursor` | `Page<Post>` | 404 | F-INT-10 |
| `PUT` / `DELETE /me/collections/{collectionId}/posts/{postId}` | Owner | — | `204`; добавление сохраняет пост, если он ещё не сохранён | 404 | F-INT-10 |

Посты, ставшие невидимыми (удалены, аккаунт закрылся, блокировка), из выдачи «Сохранённого» исключаются.
