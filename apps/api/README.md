# apps/api — NestJS backend

> **Статус:** приложение ещё не создано. Каталог содержит только этот файл и `.env.example`.
> Каркас создаётся в Phase 0 (см. [docs/IMPLEMENTATION_PLAN.md](../../docs/IMPLEMENTATION_PLAN.md)).

REST API под префиксом `/api/v1`, Swagger, PostgreSQL через Prisma, серверные сессии.

## Планируемая структура

```
apps/api/
├── prisma/
│   ├── schema.prisma        # общий файл — изменения по правилам docs/development/CHANGE_PROCESS.md
│   ├── migrations/          # генерируются Prisma, вручную не редактируются
│   └── seed.ts              # демо-данные и тестовые пользователи
├── src/
│   ├── main.ts              # bootstrap: префикс /api/v1, pipes, filters, Swagger
│   ├── app.module.ts
│   ├── config/              # загрузка и валидация переменных окружения
│   ├── common/              # глобальный фильтр ошибок, guard сессии, декораторы, пагинация
│   ├── prisma/              # PrismaService
│   ├── storage/             # StorageService: драйверы local и s3
│   ├── health/              # GET /api/v1/health
│   ├── auth/                # регистрация, вход, выход, сессии, пароли
│   ├── users/               # профили, аватар, поиск пользователей, удаление аккаунта
│   ├── follows/             # подписки
│   ├── posts/               # посты, reels, лента, лайки, комментарии, просмотры, избранное
│   ├── stories/             # сторис, просмотры и лайки сторис
│   ├── chats/               # чаты и сообщения
│   ├── search-history/      # история поиска (текст и пользователи)
│   ├── locations/           # справочник локаций
│   └── media/               # GET /api/v1/media/{id} с проверкой доступа
├── test/                    # e2e-тесты (supertest)
├── openapi.ts               # скрипт экспорта Swagger в docs/api/openapi.json
└── .env.example
```

Модули `notifications/` и `realtime/` появятся только после согласования требований.
Подробно: [docs/architecture/ARCHITECTURE.md](../../docs/architecture/ARCHITECTURE.md).
