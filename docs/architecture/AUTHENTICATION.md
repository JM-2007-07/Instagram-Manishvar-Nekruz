# Аутентификация и сессии

> Статус: ✅ направление согласовано (серверные сессии в PostgreSQL + HttpOnly cookie).
> Числовые параметры помечены 📝 — их можно уточнить без изменения архитектуры.

## 1. Модель

- Сессия хранится **на сервере** в таблице `Session` (PostgreSQL).
- Браузер получает только **случайный непрозрачный токен** в HttpOnly cookie.
- В БД хранится **SHA-256 хеш** токена, а не сам токен: утечка таблицы не даёт войти от чужого имени.
- JWT не используется: сессию в БД можно отозвать мгновенно (выход, смена пароля), и её проще объяснить.

```
Session
  id          UUID
  tokenHash   string, unique      ← sha256(token)
  userId      → User
  createdAt   datetime
  lastUsedAt  datetime
  expiresAt   datetime            ← скользящий срок (idle)
  absoluteExpiresAt datetime      ← жёсткий предел
  userAgent   string?             ← только для показа «активные сессии» (если понадобится)
```

## 2. Cookie

| Атрибут | Разработка | Продакшен | Зачем |
|---|---|---|---|
| Имя | `sid` | `__Host-sid` | префикс `__Host-` запрещает `Domain` и требует `Secure` и `Path=/` |
| `HttpOnly` | да | да | JavaScript не может прочитать токен (защита от кражи через XSS) |
| `Secure` | нет (http://localhost) | да | только HTTPS |
| `SameSite` | `Lax` | `Lax` | браузер не отправляет cookie в межсайтовых POST/fetch; переходы по ссылкам работают |
| `Path` | `/` | `/` | |
| `Max-Age` | = остаток idle-срока | = остаток idle-срока | |

Cookie ставит **только NestJS** (`Set-Cookie` в ответе), он проходит к браузеру через прокси Next.js.

## 3. Сроки 📝

| Параметр | Значение | env |
|---|---|---|
| Срок бездействия (idle) | 7 дней | `SESSION_IDLE_TTL_DAYS` |
| Абсолютный срок | 30 дней | `SESSION_ABSOLUTE_TTL_DAYS` |
| Продление | при запросе, не чаще 1 раза в час (чтобы не писать в БД на каждый запрос) | — |
| Токен сброса пароля | 30 минут, одноразовый | `PASSWORD_RESET_TTL_MINUTES` |

## 4. Сценарии

### Регистрация и вход

```mermaid
sequenceDiagram
    participant B as Браузер
    participant N as Next.js (rewrite)
    participant A as NestJS
    participant D as PostgreSQL
    B->>N: POST /api/v1/auth/login {login, password}
    N->>A: тот же запрос (+ Origin)
    A->>A: проверка Origin, rate limit
    A->>D: найти пользователя, проверить пароль (argon2id)
    A->>D: создать Session(tokenHash)
    A-->>N: 200 UserSummary + Set-Cookie: sid=<token>
    N-->>B: ответ + Set-Cookie
```

- При ошибке — `401 INVALID_CREDENTIALS` без уточнения, что неверно (логин или пароль).
- Если пользователь не найден, всё равно выполняется проверка хеша с фиктивным значением — время
  ответа не выдаёт, существует ли аккаунт.
- `login` — имя пользователя или email (Q3). Вход до подтверждения email → `403 EMAIL_NOT_VERIFIED` с возможностью
  отправить код ещё раз.

### Регистрация с подтверждением email

1. `POST /auth/register` — проверка уникальности, возраста (≥ 13 по `birthday`), пароля; создаётся `User` без
   `emailVerifiedAt` и `EmailVerificationCode` (хеш 6-значного кода, 15 минут 📝, 5 попыток 📝); письмо через `MailService`
   (в разработке — в лог).
2. `POST /auth/register/verify` — код верный → `emailVerifiedAt`, создаётся сессия, cookie (Q4).
3. Неподтверждённые аккаунты старше 7 дней 📝 удаляются фоновой задачей; имя пользователя освобождается.

### Вход через Google и Facebook ([ADR 0014](../decisions/0014-oauth-google-facebook.md))

```mermaid
sequenceDiagram
    participant B as Браузер
    participant A as NestJS (через прокси)
    participant P as Google / Facebook
    B->>A: GET /api/v1/auth/oauth/google
    A-->>B: 302 к провайдеру (state, PKCE) + cookie oauth_state
    B->>P: вход и согласие
    P-->>B: 302 /api/v1/auth/oauth/google/callback?code&state
    B->>A: callback + cookie oauth_state
    A->>P: обмен code → токены, профиль
    alt аккаунт найден / привязан
        A-->>B: 302 / + Set-Cookie: sid
    else новый пользователь
        A-->>B: 302 /accounts/oauth/complete/ + cookie oauth_pending (10 мин)
        B->>A: POST /auth/oauth/complete {userName, birthday}
        A-->>B: 201 Me + Set-Cookie: sid
    end
```

Аккаунт, созданный через провайдера, не имеет пароля (`hasPassword = false`) и может задать его через
`POST /auth/password/change` без текущего пароля.

### Активные сессии

`GET /auth/sessions` показывает устройства (браузер и ОС из `userAgent`, время последней активности, текущая);
`DELETE /auth/sessions/{id}` завершает сессию — открытые сокеты этой сессии закрываются.

### Проверка сессии на каждом запросе

1. Глобальный `SessionGuard` читает cookie. Нет cookie и маршрут не `@Public()` → `401`.
2. `sha256(token)` → поиск `Session`; нет записи, истёк `expiresAt` или `absoluteExpiresAt` → удалить запись, `401`.
3. Если `lastUsedAt` старше часа — продлить `expiresAt` (не дальше `absoluteExpiresAt`) и обновить cookie.
4. `request.user = { id, role, sessionId }` → доступен через `@CurrentUser()`; `sessionId` нужен для `isCurrent`,
   «выйти из остальных сессий» и закрытия сокетов этой сессии. Логика сессий — `src/common/session/`.

### Выход

`POST /auth/logout` → удалить `Session` → `Set-Cookie` с `Max-Age=0` → `204`.

### Смена и сброс пароля

| Действие | Сессии |
|---|---|
| `POST /auth/password/change` (нужен текущий пароль) | все **остальные** сессии удаляются, текущая остаётся |
| `POST /auth/password/forgot` | создаётся `PasswordResetToken` (в БД — хеш), ссылка отправляется письмом; в разработке — пишется в лог (`MAIL_DRIVER=log`) |
| `POST /auth/password/reset` | токен проверяется и помечается использованным; **все** сессии удаляются |
| `DELETE /me` | пользователь и все его сессии удаляются |

### Ротация

Токен сессии всегда создаёт сервер при входе — подставить свой токен (session fixation) нельзя.
Отдельная периодическая ротация токена не нужна: короткий idle-срок и отзыв при смене пароля достаточны
для учебного проекта. Пересмотреть при подготовке к продакшену.

## 5. Next.js и сессия

| Где | Что делает | Чего не делает |
|---|---|---|
| `proxy.ts` (бывший middleware) | если cookie нет — редирект на `/accounts/login/` для страниц `(main)`; если есть — пропускает | **не проверяет** сессию по-настоящему: это только удобство |
| layout `(main)` (Server Component) | `serverFetch('/me')` с cookie пользователя; `401` → `redirect('/accounts/login/')` | не загружает данные страниц |
| Client Components (RTK Query) | запросы через прокси; `401 UNAUTHENTICATED` → `baseQueryWithAuth` сбрасывает кэш и ведёт на `/accounts/login/`; вход/выход → `resetApiState()` | не читают cookie, не хранят токен в store |

Настоящая проверка — **всегда в NestJS**.

## 6. Пароли

- Алгоритм: **Argon2id** (библиотека `argon2`), параметры по рекомендациям OWASP (память ≥ 19 MiB, итерации ≥ 2).
- Длина пароля: 6–128 символов (как в [спецификации входа](../features/auth.md)); без требований к составу символов (рекомендация NIST), но с запретом
  совпадения с `userName`/`email`.
- Хеш никогда не попадает в ответы API: сервисы выбирают поля пользователя явно.

## 7. Роли

Поле `role`: `USER` (по умолчанию) и `ADMIN` (Q6 решён). Администратор управляет жалобами, галочками, банами и местами
([endpoints/admin.md](../api/endpoints/admin.md)); первый администратор создаётся seed-скриптом. Бан завершает все сессии.

## 7a. Двухфакторная аутентификация (P2)

TOTP (приложение-аутентификатор) + резервные коды; после пароля вход требует код (`POST /auth/login/2fa`).
Секрет хранится зашифрованным ключом из env.

## 8. Rate limiting чувствительных операций

См. [SECURITY.md](SECURITY.md#ограничение-частоты-запросов).
