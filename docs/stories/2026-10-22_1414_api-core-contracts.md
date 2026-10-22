# 2026-10-22 14:14 — T0.3: модели аккаунта, сессии и заглушки общих сервисов (C0)

| | |
|---|---|
| Задача | T0.3 |
| Фаза | 0 |
| Автор | Claude Code (оркестратор, Opus) по запросу Студента A (`JM-2007-07`) |
| Агенты | backend-dev (Sonnet), test-writer (Sonnet) — параллельно; verifier (Haiku), reviewer (Opus) |
| Ветка, коммиты | `feat/backend-a` · коммит с этой историей |

## Запрос
Продолжение работы над всем backend A в одной ветке. Порядок ускорен по согласию A: код и тесты параллельно, проверки всегда, ревью — на 2–3 задачи и обязательно перед PR. T0.3 — точка C0: на её интерфейсы опирается Студент B, поэтому ревью сделано сразу.

## Что сделано
- `prisma/schema/account.prisma`: `User` (поля входа и профиля, D2; без `avatarMediaId` — он появится после T1.B1; блоки для обратных связей B), `Session` (+ `ipAddress`, `userAgent`), `UserSettings`. Таблицы — snake_case через `@@map`.
  `notifications.prisma` — только enum `NotificationType` (12 значений, D11). Миграция `init_account`.
- `src/common/session/`: `SessionService` (токен 32 байта, в БД sha256; idle 7 / absolute 30 дней; продление не чаще раза в час с новой cookie; `revoke`, `revokeAllForUser(userId, except?)`; cookie HttpOnly, SameSite=Lax, Secure в production), глобальный `SessionGuard` (после `OriginGuard`), `@CurrentUser()` → `{ id, role, sessionId }`.
- `src/users`: `UserSummaryDto`, `userSummarySelect(viewerId)`, `UsersService.toSummary()`.
- Заглушки (D12): `VisibilityService`, `NotificationsService.create()`, `RealtimeService.emitToUsers()`. Модули глобальные.
- `test/helpers`: `createTestApp`, `resetDb` (только БД `*_test`), `createUser`, `loginAs`, `ORIGIN`, `withOrigin`. `prisma/seed.ts`: admin + alice, bob, carol (идемпотентно, в production не запускается).
- Документы: сигнатуры заглушек — IMPLEMENTATION_PLAN §3.1; правило имён таблиц — DATABASE_DECISIONS.

## Решения и почему
- `userSummarySelect` — функция от `viewerId`, а не константа (замечание ревью). Позже `hasActiveStory` и `isCloseFriendStory` зависят от зрителя (аудитория историй, блокировки). Иначе в T2.B1 пришлось бы ломать сигнатуру после C0 и переписывать вызовы B.
- `SessionService.create()` возвращает `{ token, sessionId }`, а не строку `Session`: в строке есть `tokenHash`, её легко случайно отдать в ответ.
- Пользователь `BANNED` с живой сессией получает 401 (в спецификации не было, выбор backend-dev, оставлен).
- Модули общих сервисов — `@Global`: B не нужно импортировать их в свои модули.
- Проверки env: в production имя cookie обязано начинаться с `__Host-`; idle-срок не больше absolute.
- Продление сессии через `updateMany`, чтобы параллельный выход не давал 404.

## Изменённые файлы
- `apps/api/prisma/schema/{account,notifications}.prisma`, `apps/api/prisma/migrations/*_init_account`, `apps/api/prisma/seed.ts`
- `apps/api/src/{common/session,users,privacy,notifications,realtime}/**`, `apps/api/src/app.module.ts`, `apps/api/src/config/env.ts`
- `apps/api/test/{helpers/**,session.e2e-spec.ts,http-foundation.e2e-spec.ts}`, `*.spec.ts`
- `apps/api/package.json` (argon2 0.45.1), `package-lock.json`
- `docs/IMPLEMENTATION_PLAN.md` §3.1, `docs/database/DATABASE_DECISIONS.md`, `docs/STATUS.md`

## Проверка
- `npm run lint`, `typecheck`, `test -w api` (34), `test:e2e -w api` (33), `build`, `openapi:export`, `format:check` → зелёные
- `prisma validate`, `prisma migrate status` → «Database schema is up to date!»; `npm run prisma:seed -w api` дважды подряд → ok
- e2e: 401 без cookie / с неизвестным токеном / BANNED / истёкшими сроками (запись удаляется); продление с Set-Cookie; порядок guard'ов (POST без Origin → 403 раньше 401); revoke и revokeAllForUser
- reviewer: 🔴 нет; 3 🟡 и почти все 🟢 исправлены
- ⚠️ не проверено: работа заглушек из модулей B (появится в их задачах)

## Проблемы и отклонения
- Оба агента (backend-dev и test-writer) один раз остановились по таймауту среды. Их возобновили, работа продолжилась без потерь.
- Пожелание ревью про метод `VisibilityService` для фильтра контента (закрытые аккаунты в списках постов B) отложено до T1.A5: новый метод добавится, а существующие сигнатуры не изменятся.

## Открытые вопросы
- —

## Что дальше
- **C0:** нужен PR веток `chore/root-tooling` и `feat/backend-a` до этого коммита в `main`, чтобы B начал Phase 1. Push и PR — по просьбе A.
- Затем T1.A1 (auth).
