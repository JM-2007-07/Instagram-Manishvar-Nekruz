# Работа в команде

Проект ведут два студента в одном GitHub-репозитории `JM-2007-07/Instagram-Manishvar-Nekruz`:
**Студент A — `JM-2007-07`**, **Студент B — `nek-yt`** (логины проверены через GitHub API 2026-10-22).
Цель правил — работать параллельно, не ломая друг другу код, и чтобы каждый мог объяснить всё приложение.
Первый раз — пройдите [ONBOARDING.md](docs/development/ONBOARDING.md) (Git-логин, клонирование, Claude Code).

## Ветки

- **`main`** — только интегрированные и работающие изменения. Прямые коммиты запрещены (защита ветки — T0.6).
- **Каждый студент работает в своих ветках.** Общей рабочей ветки нет. Одна задача `Tx.y` — одна ветка от свежего `main`:

| Тип | Пример |
|---|---|
| `feat/<модуль>-<кратко>` | `feat/media-upload` (T1.B1), `feat/auth-sessions` (T1.A1) |
| `fix/<модуль>-<кратко>` | `fix/auth-session-expiry` |
| `chore/<кратко>` | `chore/root-tooling`, `chore/ci` |
| `docs/<кратко>` | `docs/api-contract-chats` |

- Ежедневно и перед PR: `git fetch && git rebase origin/main` (интеграция — постоянно, а не в конце).
- Ветку не держать дольше 3–4 дней: большая задача делится на несколько PR (например, T1.B4: создание → ленты → лайки).
- В своей ветке студент меняет **только файлы своих модулей** и общие файлы по правилам ниже. Чужие файлы — нет.
- Влитая ветка удаляется.

## Процесс задачи

1. Взять задачу своей буквы из [STATUS.md](docs/STATUS.md) (зависимости выполнены) → отметить 🟨 и ветку.
2. Прочитать карточку модуля в [IMPLEMENTATION_PLAN.md §4](docs/IMPLEMENTATION_PLAN.md#4-карточки-модулей), спецификацию,
   `docs/api/endpoints/<module>.md`, свой раздел [DATA_MODEL.md](docs/database/DATA_MODEL.md).
3. Нужно изменить общий файл → сначала написать второму (что и зачем), изменение — отдельным коммитом в PR.
4. Небольшие понятные коммиты; PR с шаблоном: что сделано, модули, общие файлы, **какая проверка выполнена**.
5. CI зелёный, ревью второго (CODEOWNERS) → Squash and merge → STATUS ✅ + история.
6. Достигнута контрольная точка (C0, MA-1, MB-1…) → короткий совместный прогон (IMPLEMENTATION_PLAN §7).

## Коммиты

[Conventional Commits](https://www.conventionalcommits.org/), сообщение на английском:

```
feat(posts): add post creation endpoint
fix(auth): revoke other sessions on password change
docs(api): describe chat endpoints
chore(ci): add contract check
```

Типы: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. Область — модуль (`auth`, `posts`, `web`, `api`, `ci`…).

## Pull Requests

- Каждое изменение в `main` — через PR с [шаблоном](.github/pull_request_template.md).
- Ревью второго студента обязательно; цель ревью — и качество, и понимание чужого кода.
- PR небольшой: одна задача, желательно до ~400 строк изменений (без сгенерированных файлов).
- Перед запросом ревью: `npm run lint`, `npm run typecheck`, `npm run test`, [чек-лист качества](docs/QUALITY_CHECKLIST.md).
- CI должен быть зелёным. Слияние — **Squash and merge**, заголовок PR — в формате коммита.
- Ревью — в течение одного рабочего дня; блокирующие замечания отмечаются явно.

## Владельцы модулей

Распределение модулей и задач — [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md#2-потоки-работ). Владелец модуля
пишет его backend и frontend и отвечает за его спецификацию, файл эндпоинтов и файл схемы. Ревью второго студента
обеспечивает [`.github/CODEOWNERS`](.github/CODEOWNERS) вместе с защитой `main` (T0.6).
Изменения в чужом модуле — только по договорённости с владельцем, через PR с его ревью.

## Общие файлы

У каждого общего файла **один владелец**. Второй студент меняет его только так, как указано в колонке «Как менять».

| Файл / каталог | Владелец | Как менять второму |
|---|---|---|
| корневые `package.json`, `.nvmrc`, `.editorconfig`, `.gitattributes`, `.gitignore`, `.prettierrc.json`, `.prettierignore` | A | сообщение A, затем PR с ревью A |
| `package-lock.json` | — | меняется при `npm install <pkg> -w <app>` в своей задаче; при конфликте — взять версию `main` и выполнить `npm install` |
| `apps/api/{package.json,tsconfig*.json,nest-cli.json,prisma.config.ts}` | A | новые зависимости своего модуля — `npm install <pkg> -w api` в своём PR (упомянуть в описании) |
| `apps/api/src/{main.ts,config,common,prisma,mail,health}` | A | новые переменные env своего модуля — в своём PR: поле в схеме `config` + `.env.example`, ревью A |
| `apps/api/src/app.module.ts` | A | **разрешено** добавить строку импорта своего модуля |
| `apps/api/src/{realtime,privacy,notifications}` (заглушки и реализация) | A | только через A: нужна новая сигнатура — сообщение A |
| `apps/api/src/{storage,media,tags}` | B | только через B |
| `apps/api/prisma/schema/base.prisma` (generator, datasource) | A | только через A |
| `apps/api/prisma/schema/<module>.prisma` | владелец модуля | — |
| модель `User` в `account.prisma` | A | **разрешено** добавить обратные связи своих моделей (`posts Post[]`) в свой блок-комментарий `// --- <module> (B) ---`; ничего больше |
| `apps/api/prisma/migrations/` | каждый — свои миграции | по [CHANGE_PROCESS.md](docs/development/CHANGE_PROCESS.md#изменение-schemaprisma-и-миграции) |
| `apps/api/prisma/seed.ts` | A | данные своего модуля — в `prisma/seed/<module>.ts`; строку вызова в `seed.ts` разрешено добавить |
| `apps/api/test/helpers/` | A | новые помощники своего модуля — в `test/helpers/<module>.ts` |
| `docs/api/API_CONTRACT.md` (§1 соглашения, §1.4 модели), `docs/api/REALTIME.md` | A | по [CHANGE_PROCESS.md](docs/development/CHANGE_PROCESS.md#изменение-api-контракта) |
| `docs/api/endpoints/<module>.md`, раздел модуля в `DATA_MODEL.md` | владелец модуля | — |
| `docs/api/openapi.json`, `apps/web/src/lib/api/schema.d.ts` | генерируются | только `npm run contract`; при конфликте — взять `main` и сгенерировать заново |
| `apps/web/{package.json,next.config.ts}`, `src/app/{layout.tsx,globals.css}`, `src/app/(main)/layout.tsx`, `src/proxy.ts` | B | сообщение B, затем PR с ревью B |
| `apps/web/src/lib/` (кроме `realtime.ts`, `webrtc.ts` — A) | B | новый тег RTK Query (`tagTypes`) или тип в `types.ts` — **разрешено** добавить строку в своём PR |
| `apps/web/src/components/{ui,layout,states}` | B | новый компонент shadcn через CLI — разрешено; правка существующих — через B |
| `apps/web/src/features/<feature>`, страницы своих функций в `src/app/` | владелец функции | — |
| `.github/workflows/`, `.claude/settings.json` | A (T0.6) | через A |
| `.github/CODEOWNERS`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/agents/`, `docs/architecture/`, `docs/decisions/`, `docs/product/`, `docs/design/`, `docs/IMPLEMENTATION_PLAN.md` | оба | только через PR с ревью второго |
| `docs/STATUS.md` | оба | каждый — только строки своих задач; строки оглавления историй — сверху; при конфликте сохраняются **обе** |
| `docs/stories/` | оба | только новые файлы; чужие истории не редактируются |

## Параллельная работа

- Вызов модуля второго студента — **только через его опубликованный интерфейс** (таблица заглушек в
  [IMPLEMENTATION_PLAN.md §3.1](docs/IMPLEMENTATION_PLAN.md#31-как-не-ждать-друг-друга-заглушки-и-контракты)). Свою копию
  чужого модуля, «временную» альтернативную реализацию или прямые запросы к чужим таблицам в обход сервиса не писать.
- Чужого endpoint'а ещё нет → работать по `docs/api/endpoints/<module>.md`; в тестах — заглушка (`jest.mock`) или фабрика данных.
- Нужен новый метод в чужом интерфейсе → сообщение владельцу; владелец добавляет сигнатуру (можно с простейшим телом) первым коротким PR.
- Сгенерированные файлы (`openapi.json`, `schema.d.ts`, миграции) не правятся вручную.

## Изменения контракта

1. Небольшие (новый endpoint, новое необязательное поле) — PR с обновлённым `docs/api/endpoints/<module>.md` и `npm run contract`.
2. Ломающие (переименование, удаление, смена типа или обязательности) — сначала сообщение второму, затем PR.
3. Изменение общих соглашений — ADR в `docs/decisions/`.

## Документация

- Документация меняется в том же PR, что и код, который она описывает.
- Ответ на открытый вопрос `Qn` → обновить таблицу в [REQUIREMENTS.md](docs/REQUIREMENTS.md#5-открытые-вопросы)
  и все документы, которые на него ссылаются.
- Код, имена файлов и API — на английском; комментарии и документация — можно на русском.

## Секреты

Никогда не коммитьте `.env`, пароли, ключи, токены. Только `.env.example` с фиктивными значениями.
