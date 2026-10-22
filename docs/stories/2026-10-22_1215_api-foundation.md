# 2026-10-22 12:15 — T0.2: каркас NestJS 11 + Prisma 7 в `apps/api`

| | |
|---|---|
| Задача | T0.2 |
| Фаза | 0 |
| Автор | Claude Code (оркестратор, Opus) по запросу Студента A (`JM-2007-07`) |
| Агенты | planner (Opus), backend-dev (Sonnet), test-writer (Sonnet), verifier (Haiku), reviewer (Opus) |
| Ветка, коммиты | `feat/backend-a` (поверх `chore/root-tooling`) · коммит с этой историей |

## Запрос
Студент A поручил сделать весь свой backend в одной ветке и самостоятельно принимать основные решения.
Позже он же согласовал ускорение: код и тесты параллельно, проверки после каждой задачи, ревью на 2–3 задачи и обязательно перед PR.

## Что сделано
- `planner` составил план всех задач A (T0.2 → T2.A1) и список решений D1–D17. Оркестратор их принял, записи — в заметках сессии и ниже.
- `apps/api`: NestJS 11, `@nestjs/config` 4, Swagger 11, class-validator, helmet 8, cookie-parser; Prisma **7.10.1**
  (`prisma`, `@prisma/client`, `@prisma/adapter-pg` — точные версии), многофайловая схема `prisma/schema/base.prisma`, `prisma.config.ts`.
- `config`: проверка env при старте. `DATABASE_URL` должен быть postgres-URL, значение в сообщение об ошибке не попадает.
  `WEB_ORIGIN` — с протоколом, без пути. `MAIL_DRIVER=log` в production запрещён.
- `common`: единый фильтр ошибок (формат API_CONTRACT §1.2, код по статусу, Prisma P2002→409 / P2025→404, без stack и
  текстов исключений; ошибки парсера тела — общим текстом); `ValidationPipe` с `details[{field,message}]`; глобальный
  `OriginGuard` (POST/PUT/PATCH/DELETE: `Origin === WEB_ORIGIN`, `Sec-Fetch-Site` = `same-origin`); `@Public`;
  курсоры `CursorQueryDto` + `encodeCursor`/`decodeCursor` (ADR 0017); `requestId` + заголовок `X-Request-Id`.
- `app.setup.ts` — одна настройка для `main.ts` и e2e (trust proxy loopback, helmet, cookie-parser, префикс `api/v1`).
- `/api/v1/health` (`SELECT 1`, `HealthResponseDto`), Swagger UI `/api/docs` (не в production), `npm run openapi:export -w api` → `docs/api/openapi.json`.
- `mail` с драйвером log. ESLint (границы приложений, `process.env` только в `config`), Jest unit + e2e.
- Тестовая БД: `DATABASE_URL_TEST` или `DATABASE_URL` с заменой имени на `instagram_test`. Без суффикса `_test` тесты не запускаются.

## Решения и почему
- D1 пароль 6–128 (по спецификации функции) — AUTHENTICATION.md поправлен. D3 `SessionUser = { id, role, sessionId }` — там же.
- D7 путь миграций — `prisma.config.ts` (CHANGE_PROCESS поправлен). D10 курсорная пагинация (CODING_CONVENTIONS поправлен).
- Принятые отклонения backend-dev: неизвестные 4xx → `BAD_REQUEST` (5xx → `INTERNAL_ERROR`), коды 413/415; в env пока
  только нужные переменные; `openapi.ts` подставляет заглушку `DATABASE_URL`, чтобы экспорт работал без `.env` и в CI;
  `prisma` — в `dependencies` (нужен для `postinstall`).
- Весь backend A — в одной ветке по решению A. Риск: B ждёт C0 в `main`, поэтому после T0.3 нужно открыть PR.

## Изменённые файлы
- `apps/api/**` — каркас (config, prisma, common, mail, health, тесты, конфиги)
- `docs/api/openapi.json` — сгенерирован
- `.gitignore`, `.prettierignore` — `apps/api/src/generated/`; `apps/api/.env.example` — `DATABASE_URL_TEST`
- `docs/architecture/AUTHENTICATION.md`, `docs/development/{CHANGE_PROCESS,CODING_CONVENTIONS}.md`, `apps/api/README.md`
- `docs/STATUS.md`, `package-lock.json`

## Проверка
- Чистая установка: удалены `node_modules`, сгенерированный клиент и `dist`, затем `npm ci` → ok, `postinstall` сгенерировал клиент, `apps/api/package-lock.json` нет
- `npm run lint`, `npm run typecheck`, `npm run test -w api` (24), `npm run test:e2e -w api` (16, база `instagram_test`), `npm run build -w api`, `openapi:export`, `format:check` → зелёные
- живой запуск: `GET /api/v1/health` → 200 `{"status":"ok"}`, 404 в формате контракта, заголовки helmet и `X-Request-Id`
- reviewer: 🔴 нет, все 🟡 и часть 🟢 исправлены
- ⚠️ `npm audit --omit=dev`: 2 moderate (`js-yaml` в `@nestjs/swagger`), исправление только через major 12 — оставлено, в рисках STATUS
- ⚠️ не проверено: CSRF на настоящем изменяющем маршруте (появится в T1.A1), `npm run dev` вместе с web (нет `apps/web`)

## Проблемы и отклонения
- `npm install` в среде агентов не укладывался в таймаут, зависимости ставились частями. Итог проверен чистым `npm ci`.
- Старые юнит-тесты env использовали `DATABASE_URL: 'x'` и упали после ужесточения проверки. Оркестратор заменил значение на валидный URL.

## Открытые вопросы
- Q-new-1…6 из плана (лимит смены `fullName`, список `pronouns`, cookie темы, вход `BANNED`, `postCount`, `lastActiveAt`):
  взяты значения по умолчанию, применяются в T1.A1–T2.A1.

## Что дальше
- T0.3 (C0): `User`, `Session`, `UserSettings`, первая миграция, `SessionGuard`, `@CurrentUser`, заглушки, тестовые помощники, seed.
