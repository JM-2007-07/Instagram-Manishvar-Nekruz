# Эндпоинты: `auth`

> Модуль `auth` · функции F-ACC-* · спецификация [features/auth.md](../../features/auth.md) · общие правила — [API_CONTRACT.md](../API_CONTRACT.md).
> Сессии и cookie — [AUTHENTICATION.md](../../architecture/AUTHENTICATION.md). 📝 — черновик полей.

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F / # |
|---|---|---|---|---|---|
| `GET /auth/username-availability?userName=` | Public | — | `{ available, suggestions: string[] }` | 400 | F-ACC-02 |
| `POST /auth/register` | Public | `{ email, password, fullName, userName, birthday }` | `201 { email, codeSentAt }`; письмо с кодом | 400, 409 `CONFLICT`, 429 | F-ACC-01 / #1 |
| `POST /auth/register/verify` | Public | `{ email, code }` | `200 Me` + cookie сессии | 400 `VERIFICATION_CODE_INVALID`, 429 | F-ACC-01 |
| `POST /auth/register/resend-code` | Public | `{ email }` | `202` | 429 | F-ACC-01 |
| `POST /auth/login` | Public | `{ login, password }` — `login` = имя пользователя или email | `200 Me` + cookie; при 2FA — `200 { twoFactorRequired: true, challengeId }` (P2) | 401 `INVALID_CREDENTIALS`, 403 `EMAIL_NOT_VERIFIED`, 429 | F-ACC-03 / #2 |
| `POST /auth/logout` | User | — | `204`, cookie удаляется | — | F-ACC-07 |
| `POST /auth/password/forgot` | Public | `{ login }` | `202` всегда | 429 | F-ACC-08 / #3 |
| `POST /auth/password/reset` | Public | `{ token, newPassword }` | `204`; все сессии завершены | 400, 429 | F-ACC-08 / #4 |
| `POST /auth/password/change` | User | `{ currentPassword?, newPassword }` — `currentPassword` не нужен, если пароля нет (соцвход) | `204`; остальные сессии завершены | 400, 429 | F-ACC-09 / #5 |
| `GET /auth/sessions` | User | — | `{ id, userAgent, ipCity?, createdAt, lastUsedAt, isCurrent }[]` | — | F-ACC-10 |
| `DELETE /auth/sessions/{sessionId}` | Owner | — | `204` | 404 | F-ACC-10 |
| `GET /auth/oauth/providers` | Public | — | `{ google: boolean, facebook: boolean }` — какие включены | — | F-ACC-04, 05 |
| `GET /auth/oauth/{provider}` | Public | `provider` = `google` \| `facebook` | `302` к провайдеру (PKCE, `state` в короткой cookie) | 404 (выключен) | F-ACC-04, 05 |
| `GET /auth/oauth/{provider}/callback` | Public | `code`, `state` от провайдера | `302 /` (вход) или `302 /accounts/oauth/complete/` (нужна регистрация) | `302 /accounts/login/?error=oauth` | F-ACC-06 |
| `POST /auth/oauth/complete` | Public (cookie незавершённого входа) | `{ userName, birthday }` | `201 Me` + cookie | 400, 409 | F-ACC-06 |
| `DELETE /me/oauth/{provider}` | User | — | `204` — отвязать (если есть пароль или другой способ входа) | 409 `LIMIT_REACHED` | F-ACC-06 |
| `POST /auth/2fa/setup` (P2) | User | — | `{ otpauthUrl, secret }` | — | F-ACC-15 |
| `POST /auth/2fa/enable` (P2) | User | `{ code }` | `{ backupCodes: string[] }` | 400 | F-ACC-15 |
| `POST /auth/2fa/disable` (P2) | User | `{ password }` | `204` | 400 | F-ACC-15 |
| `POST /auth/login/2fa` (P2) | Public | `{ challengeId, code }` | `200 Me` + cookie | 400, 429 | F-ACC-15 |

Правила:
- `confirmPassword` проверяется только формой (P21). Пароли и токены — только в теле (P4).
- Ответы `register`, `forgot`, `resend-code` не раскрывают, существует ли аккаунт с таким email, кроме `409` при регистрации.
- Вход удалённого (`PENDING_DELETION`) или деактивированного аккаунта восстанавливает его (F-ACC-13, 14).
