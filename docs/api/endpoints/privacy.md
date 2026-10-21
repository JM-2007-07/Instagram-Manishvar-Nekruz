# Эндпоинты: `privacy`

> Модуль `privacy` · функции F-PRV-* · спецификация [features/privacy-and-safety.md](../../features/privacy-and-safety.md).
> Закрытый аккаунт включается полем `isPrivate` в `PATCH /me` ([users.md](users.md)); жалобы — [admin.md](admin.md).

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F |
|---|---|---|---|---|---|
| `PUT` / `DELETE /users/{userId}/block` | User | — | `204` | 400 (себя), 404 | F-PRV-02 |
| `GET /me/blocked` | User | `?cursor` | `Page<UserSummary>` | — | F-PRV-02 |
| `PUT` / `DELETE /users/{userId}/restrict` | User | — | `204` | 400, 404 | F-PRV-03 |
| `GET /me/restricted` | User | `?cursor` | `Page<UserSummary>` | — | F-PRV-03 |
| `PUT /users/{userId}/mute` | User | `{ posts: boolean, stories: boolean }` | `204` | 404 | F-PRV-04 |
| `DELETE /users/{userId}/mute` | User | — | `204` | — | F-PRV-04 |
| `GET /me/muted` | User | `?cursor` | `Page<UserSummary & { posts, stories }>` | — | F-PRV-04 |
| `GET /me/story-hidden-from` | User | `?cursor` | `Page<UserSummary>` | — | F-PRV-05 |
| `PUT` / `DELETE /me/story-hidden-from/{userId}` | User | — | `204` | 404 | F-PRV-05 |
| `GET /me/hidden-words` (P2) | User | — | `{ words: string[], filterOffensive: boolean }` | — | F-PRV-08 |
| `PUT /me/hidden-words` (P2) | User | `{ words, filterOffensive }` | то же | 400 | F-PRV-08 |

Правила:
- Блокировка: снимает подписки в обе стороны, скрывает профиль, контент, комментарии и сообщения в обе стороны;
  заблокированный получает `404` и не знает о блокировке.
- Ограничение: новые комментарии ограниченного — `isPendingApproval = true` (видны только ему и мне); его чат уходит в
  запросы, «прочитано» ему не показывается.
- Настройки «кто может комментировать / отмечать / упоминать» — в [settings.md](settings.md).
