# Instagram-like Social Network

Учебный экзаменационный проект двух студентов: социальная сеть по мотивам Instagram —
профили, посты и reels, лайки и комментарии, stories, подписки, личные сообщения, поиск.

> **Статус: инициализация.** Есть документация, API-контракт и минимальная структура репозитория.
> **Приложения ещё не созданы**, зависимости не установлены, команды запуска пока не работают.
> Следующий этап — Phase 0 (каркасы приложений), см. [ROADMAP](docs/ROADMAP.md).

## Технологии

| Часть | Стек |
|---|---|
| Frontend (`apps/web`) | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, openapi-fetch |
| Backend (`apps/api`) | NestJS, TypeScript, REST `/api/v1`, Swagger/OpenAPI |
| База данных | PostgreSQL + Prisma |
| Аутентификация | серверные сессии в PostgreSQL, HttpOnly cookie, Argon2id |
| Медиа | локальный диск в разработке → Cloudflare R2 / Amazon S3 |
| Позже, при обосновании | Socket.IO, Redis, BullMQ, Docker |
| Инструменты | pnpm workspaces, ESLint, Prettier, Jest, Vitest, Playwright, GitHub Actions |

## Структура

```
apps/web        Next.js frontend           (создаётся в Phase 0)
apps/api        NestJS backend + Prisma    (создаётся в Phase 0)
docs/           вся документация проекта
infrastructure/ Docker — когда понадобится
```

Подробно: [MONOREPO_STRUCTURE.md](docs/architecture/MONOREPO_STRUCTURE.md).

## Требования к окружению

Node.js 24, pnpm 12.8.2 (через `corepack enable`), PostgreSQL 16+, Git. Docker и облачные аккаунты не нужны.

## Запуск (после Phase 0)

```bash
pnpm install
pnpm dev
```

Полная инструкция: [LOCAL_SETUP.md](docs/development/LOCAL_SETUP.md).

## Документация

| Тема | Документ |
|---|---|
| Требования и открытые вопросы | [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) |
| Дорожная карта | [docs/ROADMAP.md](docs/ROADMAP.md) |
| План и распределение работы | [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) |
| Архитектура | [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) |
| Запросы frontend → backend | [docs/architecture/API_REQUEST_ARCHITECTURE.md](docs/architecture/API_REQUEST_ARCHITECTURE.md) |
| Аутентификация / безопасность | [AUTHENTICATION.md](docs/architecture/AUTHENTICATION.md), [SECURITY.md](docs/architecture/SECURITY.md) |
| Рендеринг в Next.js | [docs/architecture/RENDERING_STRATEGY.md](docs/architecture/RENDERING_STRATEGY.md) |
| Исходный Swagger и наш контракт | [API_INVENTORY.md](docs/api/API_INVENTORY.md), [API_CONTRACT.md](docs/api/API_CONTRACT.md) |
| Модель данных | [DATA_MODEL.md](docs/database/DATA_MODEL.md), [DATABASE_DECISIONS.md](docs/database/DATABASE_DECISIONS.md) |
| Спецификации функций | [docs/features/](docs/features/README.md) |
| Архитектурные решения | [docs/decisions/](docs/decisions/README.md) |
| Тестирование | [docs/development/TESTING.md](docs/development/TESTING.md) |
| Работа в команде | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Инструкции для Claude Code | [CLAUDE.md](CLAUDE.md) |
