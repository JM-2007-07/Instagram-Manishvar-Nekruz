# apps/web — Next.js frontend

> **Статус:** приложение ещё не создано. Каталог содержит только этот файл и `.env.example`.
> Каркас создаётся в Phase 0 (см. [docs/IMPLEMENTATION_PLAN.md](../../docs/IMPLEMENTATION_PLAN.md)).

Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Redux Toolkit (RTK Query), Socket.IO-клиент, WebRTC.
Интерфейс повторяет веб-Instagram по [docs/design/](../../docs/design/DESIGN_SYSTEM.md) со своим брендом.

## Планируемая структура

```
apps/web/
├── public/                      # BrandLogo, иконки приложения
├── src/
│   ├── app/                     # маршруты как в Instagram — docs/architecture/RENDERING_STRATEGY.md §2
│   │   ├── globals.css          # токены DESIGN_SYSTEM (светлая/тёмная) ↔ токены shadcn/ui
│   │   ├── (auth)/accounts/…    # вход, регистрация, код, сброс пароля, завершение соцвхода
│   │   └── (main)/              # оболочка, @modal, главная, explore, reels, p, direct, stories, [username]…
│   ├── components/
│   │   ├── ui/                  # компоненты shadcn/ui, настроенные под DESIGN_SYSTEM
│   │   ├── layout/              # боковое меню 72/238, мобильная навигация, панели
│   │   ├── states/              # EmptyState, ErrorState («Повторить»), skeleton'ы
│   │   └── rich-text.tsx        # текст с #хэштегами и @упоминаниями как ссылками
│   ├── features/                # по модулям backend: auth, profile, follows, privacy, settings, posts, comments,
│   │                            # collections, tags, stories, chat, calls, notifications, search, locations, admin
│   ├── lib/
│   │   ├── api/
│   │   │   ├── schema.d.ts      # СГЕНЕРИРОВАН из docs/api/openapi.json — не редактировать
│   │   │   ├── types.ts         # псевдонимы типов: Post, Profile, Page<T>
│   │   │   ├── base-api.ts      # единственный createApi (RTK Query): baseQuery, теги
│   │   │   ├── upload.ts        # uploadMedia() с прогрессом (XMLHttpRequest)
│   │   │   ├── errors.ts        # getApiError(), showApiError()
│   │   │   └── server.ts        # serverFetch() — только проверка сессии
│   │   ├── realtime.ts          # одно подключение Socket.IO
│   │   ├── webrtc.ts            # звонки: RTCPeerConnection, медиапотоки
│   │   ├── design.ts            # константы размеров (лента 630, карточка 470, меню 72/238…)
│   │   ├── store.ts             # makeStore(): store только с RTK Query
│   │   ├── store-provider.tsx   # 'use client' — <Provider store> + запуск realtime
│   │   └── utils.ts             # cn() от shadcn и мелкие утилиты
│   └── proxy.ts                 # быстрый редирект на /accounts/login/ без cookie (не проверка прав!)
├── next.config.ts               # rewrites: /api/* -> API_INTERNAL_URL
└── .env.example
```

Внутри `features/<name>/`: `api.ts` (эндпоинты RTK Query), `components/`, при необходимости `realtime.ts`
(обработчики событий), `schemas.ts` (схемы форм).

Подробно: [RENDERING_STRATEGY.md](../../docs/architecture/RENDERING_STRATEGY.md),
[API_REQUEST_ARCHITECTURE.md](../../docs/architecture/API_REQUEST_ARCHITECTURE.md),
[DESIGN_SYSTEM.md](../../docs/design/DESIGN_SYSTEM.md), [SCREENS.md](../../docs/design/SCREENS.md).
