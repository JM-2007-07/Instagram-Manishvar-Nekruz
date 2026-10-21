# apps/web — Next.js frontend

> **Статус:** приложение ещё не создано. Каталог содержит только этот файл и `.env.example`.
> Каркас создаётся в Phase 0 (см. [docs/IMPLEMENTATION_PLAN.md](../../docs/IMPLEMENTATION_PLAN.md)).

Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Redux Toolkit (RTK Query).

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
│   │   ├── layout/              # навигация, оболочка приложения
│   │   └── states/              # EmptyState, ErrorState («Повторить»), skeleton'ы
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
│   │   │   ├── types.ts         # понятные псевдонимы типов: Post, Profile, Page<T>
│   │   │   ├── base-api.ts      # единственный createApi (RTK Query): baseQuery, теги
│   │   │   ├── errors.ts        # getApiError(), showApiError()
│   │   │   └── server.ts        # serverFetch() — только проверка сессии в Server Components
│   │   ├── store.ts             # makeStore(): store только с RTK Query
│   │   ├── store-provider.tsx   # 'use client' — <Provider store>
│   │   └── utils.ts             # cn() от shadcn и мелкие утилиты
│   └── proxy.ts                 # быстрый редирект на /login без cookie (не проверка прав!)
├── next.config.ts               # rewrites: /api/* -> API_INTERNAL_URL
└── .env.example
```

Внутри `features/<name>/`: `api.ts` (эндпоинты RTK Query через `injectEndpoints` и хуки), `components/`, при необходимости `schemas.ts` (схемы форм).

Подробно: [docs/architecture/RENDERING_STRATEGY.md](../../docs/architecture/RENDERING_STRATEGY.md)
и [docs/architecture/API_REQUEST_ARCHITECTURE.md](../../docs/architecture/API_REQUEST_ARCHITECTURE.md).
