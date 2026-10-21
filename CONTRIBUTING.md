# Работа в команде

Проект ведут два студента в одном GitHub-репозитории. Цель правил — работать параллельно,
не ломая друг другу код, и чтобы каждый мог объяснить всё приложение.

## Ветки

- **`main`** — всегда рабочее состояние. Прямые коммиты запрещены (защита ветки в GitHub после Phase 0).
- **Feature-ветки** — короткие (1–3 дня), от свежего `main`:

| Тип | Пример |
|---|---|
| `feat/<модуль>-<кратко>` | `feat/posts-create` |
| `fix/<модуль>-<кратко>` | `fix/auth-session-expiry` |
| `chore/<кратко>` | `chore/ci` |
| `docs/<кратко>` | `docs/api-contract-chats` |

- Перед PR и при долгой работе: `git fetch && git rebase origin/main`.
- Влитая ветка удаляется.

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

Распределение — [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md#2-распределение-модулей).
Владелец модуля пишет его backend и frontend и отвечает за его спецификацию. Изменения в чужом модуле —
только по договорённости с владельцем (небольшие правки — через PR с ревью владельца).

## Общие файлы

Эти файлы влияют на обоих. Их **нельзя менять одновременно** без договорённости — перед изменением
напишите второму разработчику.

| Файл / каталог | Правило |
|---|---|
| `apps/api/prisma/schema.prisma`, `prisma/migrations/` | [CHANGE_PROCESS.md](docs/development/CHANGE_PROCESS.md#изменение-schemaprisma-и-миграции) |
| `docs/api/API_CONTRACT.md`, `docs/api/openapi.json`, `apps/web/src/lib/api/schema.d.ts` | [CHANGE_PROCESS.md](docs/development/CHANGE_PROCESS.md#изменение-api-контракта) |
| корневые `package.json`, `package-lock.json` | при конфликте lockfile — взять версию `main`, затем `npm install` заново |
| `apps/api/src/common/`, `config/`, `prisma/`, `storage/`, `main.ts`, `app.module.ts` | владелец фундамента backend (A) или по договорённости |
| `apps/web/src/lib/`, `app/layout.tsx`, `app/(main)/layout.tsx`, `components/layout/`, `next.config.ts`, `proxy.ts` | владелец фундамента frontend (B) или по договорённости |
| `apps/web/src/components/ui/` | добавлять компоненты через CLI shadcn можно обоим; правки существующих — по договорённости |
| `.github/`, `.claude/agents/`, `.env.example`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `docs/architecture/`, `docs/decisions/` | только через PR с ревью второго |
| `docs/STATUS.md` | меняют оба: каждый — только строки своих задач; записи журнала добавляются сверху. При конфликте слияния сохраняются **обе** записи |

Регистрация модуля в `app.module.ts` — одна строка; конфликт решается простым объединением обеих строк.

## Параллельная работа

- Перед началом задачи сообщите, какой модуль и какие общие файлы затронете.
- Нужен endpoint чужого модуля, которого ещё нет: сначала договоритесь о контракте в `API_CONTRACT.md`,
  затем пишите UI по нему; до влития можно использовать временные данные внутри своей ветки.
- Миграции — по очереди, см. [CHANGE_PROCESS.md](docs/development/CHANGE_PROCESS.md).
- Сгенерированные файлы (`openapi.json`, `schema.d.ts`, миграции) не правятся вручную.

## Изменения контракта

1. Небольшие (новый endpoint, новое необязательное поле) — PR с обновлённым `API_CONTRACT.md` и `npm run contract`.
2. Ломающие (переименование, удаление, смена типа или обязательности) — сначала сообщение второму, затем PR.
3. Изменение общих соглашений — ADR в `docs/decisions/`.

## Документация

- Документация меняется в том же PR, что и код, который она описывает.
- Ответ на открытый вопрос `Qn` → обновить таблицу в [REQUIREMENTS.md](docs/REQUIREMENTS.md#5-открытые-вопросы)
  и все документы, которые на него ссылаются.
- Код, имена файлов и API — на английском; комментарии и документация — можно на русском.

## Секреты

Никогда не коммитьте `.env`, пароли, ключи, токены. Только `.env.example` с фиктивными значениями.
