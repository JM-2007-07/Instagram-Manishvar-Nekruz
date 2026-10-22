# Эндпоинты: `admin`

> Модуль `admin` · функции F-PRV-11, F-MOD-01…02 · спецификация [features/moderation.md](../../features/moderation.md).

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F / # |
|---|---|---|---|---|---|
| `POST /reports` | User | `{ targetType: "POST" \| "COMMENT" \| "USER" \| "MESSAGE" \| "STORY", targetId, reason, details? }` | `201 { id }` | 400, 404, 429 | F-PRV-11 |
| `GET /admin/reports` | Admin | `?status&targetType&cursor` | `Page<Report>` с предпросмотром объекта | 403 | F-MOD-01 |
| `PATCH /admin/reports/{reportId}` | Admin | `{ status: "RESOLVED" \| "REJECTED", action?: "NONE" \| "REMOVE_CONTENT" \| "BAN_USER" }` | `Report` | 403, 404 | F-MOD-01 |
| `PUT` / `DELETE /admin/users/{userId}/verified` | Admin | — | `204` | 403, 404 | F-MOD-02 |
| `PUT` / `DELETE /admin/users/{userId}/ban` | Admin | `{ reason? }` | `204`; все сессии пользователя завершены | 403, 404 | F-MOD-01 |
| `DELETE /admin/users/{userId}` | Admin | — | `204` — немедленное удаление | 403, 404 | F-MOD-01 / #50 |

Причины жалоб (`reason`): `SPAM`, `NUDITY`, `HATE`, `VIOLENCE`, `HARASSMENT`, `FALSE_INFORMATION`, `SCAM`,
`INTELLECTUAL_PROPERTY`, `SELF_HARM`, `OTHER` 📝. Первый администратор создаётся seed-скриптом.
