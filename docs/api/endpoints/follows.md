# Эндпоинты: `follows`

> Модуль `follows` · функции F-SOC-* · спецификация [features/follows.md](../../features/follows.md).

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F / # |
|---|---|---|---|---|---|
| `PUT /users/{userId}/follow` | User | — | `200 { status: "ACCEPTED" \| "PENDING" }` | 400 (на себя), 404 | F-SOC-01, 02 / #14 |
| `DELETE /users/{userId}/follow` | User | — | `204` — отписка или отмена запроса | 404 | F-SOC-01, 02 / #15 |
| `GET /users/{userId}/followers` | User (видимость) | `?q&cursor&limit` | `Page<UserSummary & { followStatus }>` | 403 `PRIVATE_ACCOUNT`, 404 | F-SOC-05 / #12 |
| `GET /users/{userId}/following` | User (видимость) | `?q&cursor&limit` | то же | 403, 404 | F-SOC-05 / #13 |
| `DELETE /me/followers/{userId}` | User | — | `204` — удалить подписчика | 404 | F-SOC-04 |
| `GET /me/follow-requests` | User | `?cursor` | `Page<UserSummary & { requestedAt }>` | — | F-SOC-03 |
| `POST /me/follow-requests/{userId}/accept` | User | — | `204` | 404 | F-SOC-03 |
| `DELETE /me/follow-requests/{userId}` | User | — | `204` — отклонить | 404 | F-SOC-03 |
| `GET /me/close-friends` | User | `?cursor` | `Page<UserSummary>` | — | F-SOC-06 |
| `PUT` / `DELETE /me/close-friends/{userId}` | User | — | `204` | 404 | F-SOC-06 |
| `GET /me/favorite-accounts` | User | — | `UserSummary[]` | — | F-SOC-07 |
| `PUT` / `DELETE /me/favorite-accounts/{userId}` | User | — | `204` | 409 `LIMIT_REACHED` (50 📝) | F-SOC-07 |
| `GET /users/suggestions` | User | `?limit` | `(UserSummary & { reason: "FOLLOWED_BY" \| "POPULAR"; followedBy?: UserSummary })[]` | — | F-SOC-08 |

Правила:
- Подписка на закрытый аккаунт создаёт `PENDING` и уведомление `FOLLOW_REQUEST`; принятие — `FOLLOW_ACCEPTED`.
- Перевод аккаунта в открытый принимает все запросы.
- Блокировка удаляет подписки в обе стороны.
