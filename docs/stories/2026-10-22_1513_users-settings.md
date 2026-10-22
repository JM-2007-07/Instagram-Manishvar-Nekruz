# 2026-10-22 15:13 — T1.A3: профиль, `/me` и настройки (без аватара); ревью T1.A1 + T1.A3

| | |
|---|---|
| Задача | T1.A3 (и исправления T1.A1 по общему ревью) |
| Фаза | 1 |
| Автор | Claude Code (оркестратор, Opus) по запросу Студента A (`JM-2007-07`) |
| Агенты | backend-dev (Sonnet) и test-writer (Sonnet) — параллельно; verifier (Haiku); reviewer (Opus) — одно ревью на T1.A1 и T1.A3 |
| Ветка, коммиты | `feat/backend-a` · коммит с этой историей |

## Запрос
Продолжение работы над всем backend A. Аватар не входит в задачу: он зависит от `media` (T1.B1, Студент B).

## Что сделано
- Модели и миграция `add_users_settings`: `UserLink` (`users.prisma`), `UsernameChange` (`auth.prisma`), `NotificationPreference` (`settings.prisma`).
- Эндпоинты: `GET/PATCH /me`, `PUT /me/username`, `PUT /me/email` + `POST /me/email/verify`, `PUT /me/links`,
  `GET /users/{id}`, `GET /users/by-username/{userName}`, `GET/PATCH /me/settings`, `GET/PATCH /me/notification-preferences`.
- `ProfileDto` (контракт §1.4), `MeDto` его расширяет. Подписки — по умолчанию (T1.A4), `postCount = 0` (Q-new-5).
- Общий `ParseUuidPipe` → 400 `VALIDATION_ERROR` для невалидных id в пути (по контракту §1.2), включая `DELETE /auth/sessions/{id}`.
- По ревью сервисы auth разделены на `auth.service.ts` (вход, выход, сессии), `registration.service.ts`, `password.service.ts`.
  Смена email вынесена в `users/email-change.service.ts`. Файлы ≤ 250 строк.

## Решения и почему
- Старое имя закреплено за владельцем 14 дней: `UsernameChange` учитывается при смене имени, регистрации и проверке доступности. Две смены за 14 дней, третья → 429 с `Retry-After`. Подсчёт и смена — в одной транзакции с блокировкой строки.
- Профиль отдаётся только для подтверждённых и активных аккаунтов. Чужим не отдаются email, дата рождения, пол.
  Чтение идёт через `VisibilityService.assertCanViewProfile`.
- `canViewContent = visibility.canViewContent() && (isMe || !isPrivate)`. Вторая часть временная: в T1.A4/T1.A5 её заменят подписки.
- После смены пароля и после смены email неиспользованные токены сброса удаляются (замечание ревью). Иначе ссылка, отправленная на старый адрес, оставалась бы рабочей.
  Смена пароля и отзыв сессий выполняются в одной транзакции.
- `PUT /me/links`: больше 5 ссылок → 409 `LIMIT_REACHED`, список заменяется целиком.
- Настройки: `language` — `ru` | `en`; cookie `theme` (`light` | `dark` | `system`, не HttpOnly, SameSite=Lax, 1 год) ставит backend (Q-new-3). `GET /me/settings` ничего не записывает.
- Лимит смены `fullName` не реализован (Q-new-1): в модели нет учёта смен. Отмечено в спецификации и контракте.

## Изменённые файлы
- `apps/api/prisma/schema/{users,settings,auth,account}.prisma`, `apps/api/prisma/migrations/*_add_users_settings`
- `apps/api/src/users/**`, `apps/api/src/settings/**`, `apps/api/src/auth/**` (разделение сервисов), `apps/api/src/common/{validation.ts,pipes/parse-uuid.pipe.ts}`, `apps/api/src/app.module.ts`
- `apps/api/test/{users,settings,auth}.e2e-spec.ts`
- `docs/api/openapi.json`, `docs/api/endpoints/users.md`, `docs/features/{users-and-profiles,settings}.md`, `docs/STATUS.md`

## Проверка
- `npm run lint`, `typecheck`, `test` (34), `test:e2e -w api` (**154**), `build`, `openapi:export`, `format:check` → зелёные (последний прогон — оркестратор, после всех исправлений)
- reviewer (T1.A1 + T1.A3): 1 🔴 и 6 🟡 исправлены, большая часть 🟢 тоже
- ⚠️ не проверено: аватар (после T1.B1); тайминг ответов forgot/resend для несуществующих аккаунтов отличается (замечание 🟢, для учебного проекта допустимо)

## Проблемы и отклонения
- backend-dev добавил в `tsconfig.json` строку `"ignoreDeprecations": "6.0"`. Её не принимает установленный TypeScript 5.9.3, из-за чего падали typecheck и build. Это нашли verifier и reviewer, оркестратор строку убрал.
- backend-dev один раз делал `git stash` (и сразу `pop`), чтобы проверить базовое состояние. Потерь нет, список stash пуст.
- e2e двух агентов, запущенные одновременно на одной `instagram_test`, мешают друг другу. Тесты нужно гонять по очереди.

## Открытые вопросы
- Q-new-1 (лимит смены `fullName`) — нужна модель учёта смен, если преподаватель потребует.

## Что дальше
- T1.A4 `follows` (подписки, запросы, списки, рекомендации), затем T1.A5 `privacy`.
