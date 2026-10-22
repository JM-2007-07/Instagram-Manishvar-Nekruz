# 2026-10-22 22:42 — Стыки backend A с модулями B, «Сохранённое» и CI (T0.6)

| | |
|---|---|
| Задача | стыки T1.A3, T1.A6, T2.A2, T2.A4, T4.A2; T2.A3 + T4.A5; T0.6 |
| Фаза | 0–4 |
| Автор | Claude Code (оркестратор, Opus) по запросу Студента A (`JM-2007-07`) |
| Агенты | backend-dev ×4 (Sonnet) параллельно + 1 на исправления; миграция, прогон, исправления — оркестратор |
| Ветка, коммиты | `feat/a-integrations` от `main` (после PR #8–#10) · коммит с этой историей |

## Запрос
Backend B влит в `main` (PR #9), туда же T0.4, T0.5 и T0.7. Студент A попросил закрыть стыки своих модулей с модулями B, прежде чем решать, как делать frontend.

## Что сделано
- **Аватар:** `PUT/DELETE /me/avatar` через `MediaService.attach`, `avatarUrl` во всех `UserSummary`, `Profile`, `Me`.
- **Direct:** медиа (1–10 файлов), голосовые, «поделиться постом/историей», фото группы. Сообщение `CALL` создаётся после звонка. Связи `MessageMedia`/`sharedPost`/`story`/`call`/`Chat.avatarMedia` стали настоящими FK.
- **«Сохранённое» и подборки (T2.A3, T4.A5):** сохранить и убрать пост, `GET /me/saved`, подборки (создать, переименовать, удалить, обложка, посты); `isSavedByMe` в `PostDto`.
- **Уведомления:** FK на пост, комментарий, историю; в списке настоящие превью (shortcode, миниатюра, текст комментария).
- **Поиск:** `/search/hashtags`, `/search/locations`, хэштеги и места в `GET /search`, история `HASHTAG`/`LOCATION`.
- **Профиль:** `postCount` (опубликованные, не архивные); `hasActiveStory`/`isCloseFriendStory` в `userSummarySelect(viewerId)` с учётом аудитории.
- **T0.6 CI:** `.github/workflows/ci.yml`. Шаги: format/lint/typecheck/unit, e2e с PostgreSQL 17 и ffmpeg, проверка контракта (`npm run contract` + `git diff --exit-code`), проверка ссылок `npm run docs:links` (`scripts/check-doc-links.mjs`).
- Миграция `add_integrations_collections`, `npm run contract` (openapi.json + schema.d.ts).

## Решения и почему
- `migrate dev` в этой среде не работает неинтерактивно, когда есть предупреждения (новые уникальные индексы). SQL получен через `prisma migrate diff` от БД, удалений нет, применён `migrate deploy`.
- `StoriesService` ↔ `ChatsService` — `forwardRef`: модули ссылаются друг на друга (ответы на истории и «поделиться историей»).
- События `message:new`/`message:updated`/`message:reaction` шлются каждому участнику отдельно: видимость поста или истории в сообщении зависит от зрителя.
- `postCount` считается через `_count` в профиле, а не через `PostsService`: иначе получился бы цикл `posts` ↔ `users`.
- `.claude/settings.json` (разрешения Claude для проекта) подготовлен, но **не закоммичен**: ждёт решения Студента A.

## Проверка
- `npm run contract`, `lint`, `typecheck`, `test` (api 65, web 59), `format:check`, `docs:links` (109 файлов, 0 битых), `build` api и web → зелёные
- `npm run test:e2e -w api` → **566 passed**, 3 skipped (видео без ffmpeg), 26 наборов
- Первый прогон: 29 падений. Причины:
  - цикл импорта `stories` ↔ `chats` (упал весь набор Direct);
  - `userSummarySelect('')` в реакциях: пустой uuid после фильтра историй (ошибка кода, 500);
  - тесты с выдуманными id после появления FK;
  - тесты, считавшие число рассылок событий.
- ⚠️ не проверено: CI на GitHub (запустится на PR), защита `main` (настраивается вручную), живые звонки и соцвход.

## Что дальше
- PR `feat/a-integrations` → `main`. Настроить защиту `main` (шаги ниже).
- Решить, как делить frontend.

Защита `main` (GitHub → Settings → Rules): обязательный PR с 1 approval и ревью CODEOWNERS; обязательные проверки CI
(`format, lint, typecheck, unit tests`, `e2e (PostgreSQL)`, `API contract is up to date`, `docs links`); запрет force-push.
