# Передача дел: что сделал Студент A и как работать Студенту B (2026-10-22)

> Для Студента B (`nek-yt`) и его Claude Code. Прочитай целиком перед началом работы. Источник истины по статусу — [STATUS.md](../STATUS.md),
> по сигнатурам общих сервисов — [IMPLEMENTATION_PLAN.md §3.1](../IMPLEMENTATION_PLAN.md). Здесь — сводка и инструкции.

## 0. Срочно: сроки и порядок

- **Сдача — 2026-10-24.** Объём — полный паритет с Instagram (как в FEATURE_CATALOG). Команда перешла в **быстрый режим**:
  код и ключевые e2e-тесты пишет один агент, проверки (`lint`, `typecheck`, `test`, `test:e2e`) — всегда, ревью — одно перед сдачей.
- **Порядок слияния PR (по очереди):** [#5](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/5) (T0.1, корень)
  → [#6](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/6) (C0: T0.2 + T0.3)
  → [#7](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/7) (backend A). У #6 база — ветка #5, у #7 — ветка #6;
  после слияния предыдущего GitHub переключит базу на `main`.
- **Что нужно от B прямо сейчас:**
  1. Ревью и слияние **#5** — после этого B может начинать **T0.4** (каркас Next.js). Ревью #6 — после этого B начинает свой backend (Phase 1: T1.B1–T1.B5).
  2. **T0.4 — первым делом**, отдельным PR: без него Студент A не может начать свой frontend (вход, профиль, Direct).
  3. Затем backend B: `media`+`storage` (T1.B1), `tags` (T1.B2), `locations` (T1.B3), `posts` (T1.B4), `comments` (T1.B5), `stories` (T2.B1).

## 1. Что готово у A (backend, `apps/api`)

| Задача | Где | Состояние |
|---|---|---|
| T0.1 корень: Prettier 3.9.10, `concurrently` | PR #5 | на ревью |
| T0.2 каркас: NestJS 11, Prisma **7.10.1**, config, ошибки, CSRF, курсоры, Swagger, ESLint, Jest | PR #6 | на ревью |
| T0.3 C0: `User`/`Session`/`UserSettings`, сессии, `SessionGuard`, заглушки общих сервисов, `test/helpers`, seed | PR #6 | на ревью |
| T1.A1 `auth`: регистрация с кодом, вход, выход, сброс/смена пароля, сессии, лимиты | PR #7 | готово |
| T1.A3 `users` + `settings`: `/me`, профиль, имя, email, ссылки, настройки (**без аватара**) | PR #7 | готово |
| T1.A4 `follows`, T1.A5 `privacy` (блокировки, настоящий `VisibilityService`) | PR #7 | готово |
| T1.A6 `search`: аккаунты, `@`-подсказки, история (**без хэштегов и мест**) | PR #7 | готово |
| T2.A1 `realtime`: Socket.IO в API (`lib/realtime.ts` во frontend — после T0.4) | PR #7 | готово |
| T2.A2 `notifications`, T2.A4 `chats` (текст), T4.A1 соцвход, T4.A2 звонки, T4.A3 ограничение/скрытие/близкие друзья/избранное, T4.A4 удаление аккаунта и 2FA | PR #7 (`911392c`) | готово (backend; медиа в Direct и превью постов — после модулей B) |

Тесты: 43 unit, **390 e2e** — зелёные. Swagger: `npm run dev:api` → http://localhost:4000/api/docs.

## 2. Как писать модуль B, опираясь на готовое (обязательно)

Все перечисленные модули **глобальные** (`@Global`) — импортировать их в свой модуль не нужно.

**Запрос и пользователь**
- `SessionGuard` глобальный: все маршруты требуют сессию. Публичный маршрут — `@Public()` (`src/common/decorators/public.decorator.ts`).
- Текущий пользователь — только `@CurrentUser() user: SessionUser` → `{ id, role, sessionId }` (`src/common/session/current-user.decorator.ts`).
- CSRF: глобальный `OriginGuard` — POST/PUT/PATCH/DELETE обязаны иметь `Origin = WEB_ORIGIN`. В тестах — `.set('Origin', ORIGIN)`.
- Порядок guard'ов: Origin → Session → Throttler. Свои лимиты — `@Throttle({ default: { limit, ttl } })` (`src/common/throttler/app-throttler.ts`).

**Ошибки и валидация**
- Формат ошибок — API_CONTRACT §1.2, его делает общий фильтр. Свой код ошибки: `throw new ConflictException({ code: 'LIMIT_REACHED', message: '…' })` и т.п.
  Prisma P2002 → 409, P2025 → 404 — автоматически. Stack и тексты исключений клиенту не уходят.
- id в пути — `@Param('id', ParseUuidPipe)` из `src/common/pipes/parse-uuid.pipe.ts` (→ 400 `VALIDATION_ERROR`), **не** `ParseUUIDPipe` Nest.
- Ошибка по полю вручную — `validationError(field, message)` из `src/common/validation.ts`.
- `ValidationPipe`: whitelist + forbidNonWhitelisted — лишние поля в теле → 400. Каждое DTO с `@ApiProperty`.

**Пагинация (ADR 0017)**
- Запрос — `CursorQueryDto` (`cursor?`, `limit` 1–50, по умолчанию 20) из `src/common/pagination/cursor-query.dto.ts`; ответ — `{ items, nextCursor }`.
- Курсор — `encodeCursor({ createdAt, id })` / `decodeCursor()` из `src/common/pagination/cursor.ts`; для релевантности — offset-курсор оттуда же.
  Брать `limit + 1`, порядок `createdAt desc, id desc`.

**Пользователи в ответах**
- Автор/участник: `select: { author: { select: userSummarySelect(viewerId) } }` + `usersService.toSummary(row)` → `UserSummaryDto`
  (`src/users/user-summary.select.ts`, `src/users/users.service.ts`). `userSummarySelect` — **функция от зрителя** (позже в ней
  появится признак активной истории). Никогда не выбирать `passwordHash`, `email`, `birthday` чужих пользователей.

**Приватность — каждая выдача B должна её учитывать** (`src/privacy/visibility.service.ts`)
- Один объект: `await visibility.assertCanViewContent(viewerId, authorId)` → 404 (блокировка/нет автора) или 403 `PRIVATE_ACCOUNT`.
- Списки контента (лента, хэштег, место, «Интересное», reels): `where: { author: visibility.visibleAuthorWhere(viewerId) }`.
- Списки людей (лайкнувшие и т.п.): `where: visibility.visibleUserWhere(viewerId)` или фильтр по `getHiddenUserIds(viewerId)`.
- Истории: `isCloseFriend(ownerId, viewerId)` (аудитория «Близкие друзья»), `getStoryHiddenFromIds(ownerId)` («скрыть историю от»).
- Лента: `getMutedUserIds(viewerId, 'posts' | 'stories')` (скрытые), `getFavoriteIds(viewerId)` (лента «Избранное»).
- Комментарии: `isRestricted(ownerId, commenterId)` — комментарий ограниченного виден только ему и на одобрение владельцу.
- Подписки для ленты: `followsService.getFollowingIds(userId)` (только ACCEPTED), `isFollowing(viewerId, ownerId)`.

**Уведомления и события**
- `notificationsService.create({ recipientId, actorId, type, postId?, commentId?, storyId? })` — **после** транзакции; себя, выключенные
  настройки и блокировки сервис отсекает сам; ошибки не ломают основное действие. Отмена действия (снят лайк) —
  `notificationsService.remove({ …те же поля })`. Типы — enum `NotificationType` (`prisma/schema/notifications.prisma`).
- Событие клиентам — `realtimeService.emitToUsers(userIds, event, payload)`; имена событий — `docs/api/REALTIME.md`.

**Почта** — `mailService.send({ to, subject, text })` (в dev пишет в лог).

## 3. Схема БД и миграции (ADR 0018)

- Модели B — в своих файлах `apps/api/prisma/schema/<module>.prisma`. Общие правила — [DATABASE_DECISIONS.md](../database/DATABASE_DECISIONS.md):
  таблицы — `@@map("snake_case_plural")`, колонки — camelCase, id — `String @id @default(uuid()) @db.Uuid`.
- Обратные связи на `User` — **только** в своём блоке-комментарии в `account.prisma` (`// --- posts (B) ---` и т.д.).
- Клиент Prisma генерируется в `apps/api/src/generated/prisma` (в `.gitignore`); импорт: `import { Prisma } from '@/generated/prisma/client'`.
  `npm install` сам делает `prisma generate` (postinstall).
- Миграция: `npm exec -w api -- prisma migrate dev --name <name>` после rebase на свежий `main` (CHANGE_PROCESS.md). Влитые миграции не править.
- **Поля, которые ждут модели B** (сейчас nullable `@db.Uuid` без relation, с комментарием «FK — после …»):
  `Notification.postId/commentId/storyId`, поля медиа/поста/истории в сообщениях чата. Когда B создаёт `Post`, `Comment`, `Story`, `Media` —
  добавить relation и миграцию (сообщить A, это файлы A).

## 4. Что A ждёт от B (точки стыка)

| Нужно от B | Зачем A | Что сделать |
|---|---|---|
| T0.4 каркас Next.js (`baseApi`, store, токены, компоненты) | весь frontend A | отдельный PR как можно раньше |
| `MediaService` (T1.B1): загрузка + привязка + URL | аватар (`PUT/DELETE /me/avatar`, `User.avatarMediaId`), медиа и голосовые в Direct, аватар группы | сообщить A сигнатуру `attach`/`toMediaItem` |
| `PostsService.countByAuthor(userId)` (T1.B4) | `Profile.postCount` (сейчас 0) | публичный метод |
| `PostsService.toPostDto()` (T1.B4) | «Сохранённое» (T2.A3), «поделиться постом» в Direct, превью в уведомлениях | — |
| `TagsService`, `LocationsService` (T1.B2/T1.B3) | поиск хэштегов и мест в `/search`, история поиска HASHTAG/LOCATION | методы поиска |
| истории (T2.B1) | `hasActiveStory` в `userSummarySelect(viewerId)`, ответы на истории → `ChatsService.sendSystemMessage` | — |

## 5. Ловушки окружения (проверено на практике)

- **TypeScript 5.9.3.** Если редактор предлагает добавить `"ignoreDeprecations": "6.0"` в `apps/api/tsconfig.json` — **не принимать**: ломает `typecheck` и `build`.
- Prisma ставить только **7.x** точной версией (`latest` в npm — 8.0.0-rc). Не обновлять Nest до 12, ESLint до 10, TS до 6.
- e2e: БД `instagram_test` (или `DATABASE_URL_TEST`); без суффикса `_test` тесты не стартуют. Два прогона e2e **одновременно нельзя** (общая БД).
  Помощники: `createTestApp`, `resetDb`, `createUser(app, { isPrivate, status, … })`, `loginAs(app, user)` → cookie, `ORIGIN`, `withOrigin` из `test/helpers`;
  `resetThrottler(app)` из `test/helpers/throttler.ts`; письма — `overrideProvider(MailService).useValue({ send: async (m) => inbox.push(m) })`.
- `npm run contract` целиком заработает после T0.5 (B): сейчас есть только `npm run openapi:export -w api` → `docs/api/openapi.json`.
- Зависимости — только из корня: `npm install <pkg> -w api|web`.

## 6. Принятые решения, которые касаются B

- Пароль 6–128; ошибки — коды из API_CONTRACT §1.2; неизвестные 4xx → `BAD_REQUEST`.
- Блокировка скрывает профиль и контент **в обе стороны** (404, неотличимо от «не существует»); закрытый аккаунт → 403 `PRIVATE_ACCOUNT` для контента и списков.
- Тема: cookie `theme` = `light|dark|system` (не HttpOnly, ставит backend в `PATCH /me/settings`) — для первой отрисовки в T0.4/T0.7.
- `isPrivate` в `UserSummary` есть (по контракту).

## 7. Инструкция для Claude Студента B

1. `git fetch`, прочитай AGENTS.md, этот файл, STATUS.md, IMPLEMENTATION_PLAN §3.1.
2. Работай **только над задачами B**; файлы A меняй только по правилам CONTRIBUTING «Общие файлы» (строка импорта в `app.module.ts`, связи в своём блоке `User`, свои `seed/<module>.ts`).
3. Порядок: ревью #5 → T0.4 (PR) → ревью #6 → T1.B1 → T1.B2/T1.B3 → T1.B4 → T1.B5 → T2.B1 → frontend B.
4. В каждой выдаче контента применяй `VisibilityService` (раздел 2), вызывай `NotificationsService.create` в точках контракта, пиши e2e с `createUser`/`loginAs`.
5. Нужен новый метод в сервисе A или поле в файле A — напиши Студенту A, не меняй сам.
