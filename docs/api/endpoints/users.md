# Эндпоинты: `users`

> Модуль `users` · функции F-PRF-*, F-ACC-11…14 · спецификация [features/users-and-profiles.md](../../features/users-and-profiles.md).

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F / # |
|---|---|---|---|---|---|
| `GET /me` | User | — | `Me` — также проверка сессии | 401 | F-PRF-12 / #53 |
| `PATCH /me` | User | `{ fullName?, bio?, pronouns?, gender?, genderCustom?, isPrivate? }` | `Me` | 400, 429 (смена имени чаще лимита) | F-PRF-02, 04, F-PRV-01 / #54 |
| `PUT /me/username` | User | `{ userName }` | `Me` | 400, 409, 429 (2 раза за 14 дней 📝) | F-ACC-11 |
| `PUT /me/email` | User | `{ email, password? }` | `202` — код на новый адрес | 400, 409, 429 | F-ACC-12 |
| `POST /me/email/verify` | User | `{ code }` | `Me` | 400 `VERIFICATION_CODE_INVALID` | F-ACC-12 |
| `PUT /me/avatar` | User | `{ mediaId }` (изображение, загруженное через `POST /media`) | `Me` | 409 `MEDIA_NOT_READY`, 415 | F-PRF-06 / #56 |
| `DELETE /me/avatar` | User | — | `204` | — | F-PRF-06 / #57 |
| `PUT /me/links` | User | `{ links: { url, title? }[] }` — список целиком, до 5 📝 | `Me` | 400, 409 `LIMIT_REACHED` | F-PRF-03 |
| `POST /me/deactivate` (P2) | User | `{ password }` | `204`, выход | 400 | F-ACC-13 |
| `DELETE /me` | User | `{ password }` (у аккаунта без пароля — повторный вход через провайдера 📝) | `202 { deletionScheduledAt }`, выход | 400 | F-ACC-14 / #50 |
| `GET /users/{userId}` | User (видимость) | — | `Profile` | 404 (нет или блокировка) | F-PRF-01, 11, 16 / #51, #52 |
| `GET /users/by-username/{userName}` | User (видимость) | — | `Profile` | 404 | F-PRF-15 |
| `GET /users/{userId}/mutual-followers` | User | `?cursor&limit` | `Page<UserSummary>` | 404 | F-PRF-13 |

Правила:
- `Profile.canViewContent = false` для закрытого аккаунта без подписки: счётчики и шапка видны, списки и контент — `403 PRIVATE_ACCOUNT`.
- Заблокировавший или заблокированный пользователь получает `404` на профиль и всё, что с ним связано.
- Поиск пользователей — в модуле `search` (`GET /search/users`, исходный #41).
