# apps/web — Next.js frontend

> **Статус:** приложение ещё не создано. Каталог содержит только этот файл и `.env.example`.
> Каркас создаётся в Phase 0 (см. [docs/IMPLEMENTATION_PLAN.md](../../docs/IMPLEMENTATION_PLAN.md)).

Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query.

## Планируемая структура

```
apps/web/
├── public/
├── src/
│   ├── app/                     # только маршруты, layout'ы и сборка страниц
│   │   ├── (auth)/              # login, register, forgot-password, reset-password
│   │   └── (main)/              # страницы для вошедшего пользователя
│   ├── components/
│   │   ├── ui/                  # компоненты shadcn/ui (генерируются CLI shadcn)
│   │   └── layout/              # навигация, оболочка приложения
│   ├── features/                # код по функциональным модулям
│   │   ├── auth/
│   │   ├── profile/
│   │   ├── posts/
│   │   ├── stories/
│   │   ├── follows/
│   │   ├── chat/
│   │   ├── search/
│   │   └── locations/
│   ├── lib/
│   │   ├── api/
│   │   │   ├── schema.d.ts      # СГЕНЕРИРОВАН из docs/api/openapi.json — не редактировать
│   │   │   ├── client.ts        # единственный API-клиент для браузера
│   │   │   ├── server.ts        # тот же клиент для Server Components (server-only)
│   │   │   └── errors.ts        # разбор ошибок API
│   │   ├── query-client.ts      # настройка TanStack Query
│   │   └── utils.ts             # cn() от shadcn и мелкие утилиты
│   └── proxy.ts                 # быстрый редирект на /login без cookie (не проверка прав!)
├── next.config.ts               # rewrites: /api/* -> API_INTERNAL_URL
└── .env.example
```

Внутри `features/<name>/`: `api.ts` (запросы и хуки TanStack Query), `components/`, при необходимости `schemas.ts` (схемы форм).

Подробно: [docs/architecture/RENDERING_STRATEGY.md](../../docs/architecture/RENDERING_STRATEGY.md)
и [docs/architecture/API_REQUEST_ARCHITECTURE.md](../../docs/architecture/API_REQUEST_ARCHITECTURE.md).
