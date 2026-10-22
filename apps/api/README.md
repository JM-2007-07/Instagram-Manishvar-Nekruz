# apps/api — NestJS backend

> **Статус:** каркас создан (T0.2): config, prisma, common, mail, health, Swagger. Доменные модули добавляются по
> [плану](../../docs/IMPLEMENTATION_PLAN.md); те, что ниже без пометки, ещё не созданы.

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
│   ├── main.ts              # запуск: Swagger UI /api/docs (не в production), listen
│   ├── app.setup.ts         # общая настройка (префикс /api/v1, helmet, pipe, filter); её же вызывают e2e-тесты
│   ├── app.module.ts
│   ├── swagger.ts           # сборка OpenAPI-документа
│   ├── openapi.ts           # экспорт Swagger в docs/api/openapi.json (npm run openapi:export)
│   ├── generated/           # клиент Prisma (prisma generate), в git не попадает
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
├── test/                    # e2e-тесты (supertest), jest-e2e.json, global-setup.ts
│   └── helpers/             # createUser, loginAs — A; <module>.ts — владелец модуля
└── .env.example
```

Ответственность и зависимости модулей — [docs/architecture/ARCHITECTURE.md §3.2](../../docs/architecture/ARCHITECTURE.md#32-модули);
эндпоинты — [docs/api/endpoints/](../../docs/api/API_CONTRACT.md#2-эндпоинты-по-модулям).

## Запуск

1. Из корня репозитория: `npm install` (после установки автоматически выполняется `prisma generate`).
2. Скопируйте `.env.example` в `apps/api/.env` и впишите свой пароль PostgreSQL в `DATABASE_URL`.
3. Создайте БД `instagram` (и `instagram_test` для e2e). Запуск: `npm run dev -w api`, проверка: `GET http://localhost:4000/api/v1/health`.

## Скрипты (`npm run <script> -w api`)

| Скрипт | Что делает |
|---|---|
| `dev` / `build` / `start` | запуск с перезагрузкой / сборка в `dist` / запуск собранного |
| `lint` / `typecheck` | ESLint / проверка типов TypeScript |
| `test` | юнит-тесты (`src/**/*.spec.ts`) |
| `test:e2e` | e2e-тесты (`test/*.e2e-spec.ts`) на отдельной БД, по одному файлу за раз |
| `openapi:export` | собирает приложение и пишет `docs/api/openapi.json` (БД не нужна; не запускать вместе с `dev` — сборка очищает `dist`) |
| `prisma:generate` / `prisma:migrate` / `prisma:seed` | клиент Prisma / миграция в dev / начальные данные |

## Тестовая БД (e2e)

`test/global-setup.ts` берёт `DATABASE_URL_TEST`; если она не задана — `DATABASE_URL` с именем БД `instagram_test`.
Имя БД обязано оканчиваться на `_test` (тесты чистят таблицы), иначе тесты не запускаются. Перед тестами выполняется
`prisma migrate deploy`.
