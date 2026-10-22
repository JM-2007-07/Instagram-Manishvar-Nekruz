# Эндпоинты: `settings`

> Модуль `settings` · функции F-SET-*, F-PRV-06, 07, 09, 10, F-NTF-06 · спецификация [features/settings.md](../../features/settings.md).

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F |
|---|---|---|---|---|---|
| `GET /me/settings` | User | — | `{ commentsFrom, tagsFrom, mentionsFrom, showActivityStatus, hideLikeCounts, allowStoryResharing, theme, language }` | — | F-SET-02, 03, F-PRV-06, 07, 09, 10 |
| `PATCH /me/settings` | User | любые поля из ответа | то же | 400 | то же |
| `GET /me/notification-preferences` | User | — | `{ type, enabled }[]` | — | F-NTF-06 |
| `PATCH /me/notification-preferences` | User | `{ type, enabled }[]` | то же | 400 | F-NTF-06 |
| `GET /me/activity/likes` (P2) | User | `?cursor` | `Page<Post>` | — | F-SET-05 |
| `GET /me/activity/comments` (P2) | User | `?cursor` | `Page<Comment>` | — | F-SET-05 |
| `POST /me/data-export` (P2) | User | — | `202` — ссылка на архив придёт письмом | 429 | F-SET-06 |

Значения `commentsFrom`, `tagsFrom`, `mentionsFrom`: `EVERYONE` / `FOLLOWING` / `MUTUAL` / `NO_ONE`; `theme`: `LIGHT` / `DARK` / `SYSTEM`.
Тема дублируется в cookie, чтобы страница рендерилась без мигания.
