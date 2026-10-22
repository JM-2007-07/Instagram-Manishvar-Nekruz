# apps/api — NestJS backend

> **Статус:** приложение ещё не создано. Каталог содержит только этот файл и `.env.example`.
> Каркас создаётся в Phase 0 (см. [docs/IMPLEMENTATION_PLAN.md](../../docs/IMPLEMENTATION_PLAN.md)).

REST API `/api/v1` и Socket.IO, Swagger, PostgreSQL через Prisma, серверные сессии, обработка медиа (sharp, ffmpeg).

## Планируемая структура

```
apps/api/
├── prisma.config.ts         # Prisma 7: schema → prisma/schema (многофайловая схема, ADR 0018)
├── prisma/
│   ├── schema/
│   │   ├── base.prisma      # generator, datasource — A
│   │   ├── account.prisma   # User, Session, UserSettings — A
│   │   └── <module>.prisma  # модели модуля — его владелец (docs/database/DATA_MODEL.md §1)
│   ├── migrations/          # генерируются Prisma, вручную не редактируются
│   ├── seed.ts              # A; вызывает seed/<module>.ts
│   └── seed/<module>.ts     # данные модуля — его владелец
├── src/
│   ├── main.ts              # bootstrap: префикс /api/v1, pipes, filters, helmet, Swagger
│   ├── app.module.ts
│   ├── config/              # загрузка и валидация env
│   ├── common/              # фильтр ошибок, SessionGuard, @Public, @CurrentUser, Origin, курсоры, разбор #/@
│   ├── prisma/              # PrismaService
│   ├── storage/             # StorageService: local, s3
│   ├── mail/                # MailService: log, SMTP/сервис
│   ├── realtime/            # Socket.IO-шлюз, RealtimeService, присутствие
│   ├── health/
│   ├── auth/                # регистрация с кодом, вход, соцвход, сессии, пароли
│   ├── users/               # /me, профили, имя пользователя, аватар, ссылки, удаление
│   ├── settings/            # настройки, тема, язык, настройки уведомлений
│   ├── privacy/             # блок, ограничение, скрытие; VisibilityService
│   ├── follows/             # подписки, запросы, близкие друзья, избранное, рекомендации
│   ├── media/               # POST /media, раздача, обработка (sharp, ffmpeg), очередь
│   ├── tags/                # хэштеги, упоминания
│   ├── posts/               # публикации, reels, ленты, «Интересное», лайки, воспроизведения
│   ├── comments/            # комментарии, ответы, лайки, закрепление
│   ├── collections/         # сохранённое, подборки
│   ├── stories/             # истории, стикеры, просмотры, актуальное, архив
│   ├── chats/               # Direct: чаты, группы, сообщения, реакции
│   ├── calls/               # звонки, ICE-серверы, сигнализация
│   ├── notifications/       # уведомления, значки
│   ├── search/              # поиск, история поиска
│   ├── locations/           # места
│   └── admin/               # жалобы, модерация
├── test/                    # e2e-тесты (supertest)
│   └── helpers/             # createUser, loginAs — A; <module>.ts — владелец модуля
├── openapi.ts               # экспорт Swagger в docs/api/openapi.json
└── .env.example
```

Ответственность и зависимости модулей — [docs/architecture/ARCHITECTURE.md §3.2](../../docs/architecture/ARCHITECTURE.md#32-модули);
эндпоинты — [docs/api/endpoints/](../../docs/api/API_CONTRACT.md#2-эндпоинты-по-модулям).
