# Стратегия рендеринга (Next.js App Router)

> Статус: ✅ согласовано ([ADR 0010](../decisions/0010-rtk-query.md)). Принцип: **Server Components — оболочка
> и проверка входа; данные страниц — RTK Query в Client Components.** Один путь загрузки данных, без лишних серверных слоёв.

## 1. Кто за что отвечает

| Часть Next.js | Используем для | Не используем для |
|---|---|---|
| **Server Components** | layout'ы и оболочка страниц; проверка сессии в layout `(main)` и `(auth)` через `serverFetch('/me')`; статический текст; `generateMetadata` | загрузку данных страниц, изменения данных, состояние UI |
| **Client Components** (`'use client'`) | всё, что показывает данные API или реагирует на действия: ленты, профиль, пост, формы, чат; запросы — хуки RTK Query | прямой доступ к env сервера, чтение cookie |
| **Route Handlers** (`app/**/route.ts`) | **не используются** — прокси `/api/*` делает rewrite. Исключение — запасной вариант прокси (API_REQUEST_ARCHITECTURE.md §2) | дублирование API NestJS |
| **Server Actions** | **не используются** | изменения данных идут мутациями RTK Query → `/api/v1` |
| **`proxy.ts`** (в Next.js 16 так называется бывший `middleware.ts`) | быстрый редирект на `/accounts/login/`, если нет cookie сессии | настоящую проверку сессии и прав |
| **Backend NestJS** | вся бизнес-логика, права, данные | — |

**Почему данные страниц не грузятся на сервере.** Все страницы приложения закрыты входом, поисковая индексация
не нужна. Загрузка на сервере дала бы чуть более быстрый первый показ, но потребовала бы двух путей загрузки
одних и тех же данных и передачи их в кэш RTK Query. Один клиентский путь проще объяснить и сложнее сломать.

## 2. Маршруты

Адреса повторяют Instagram — полный список с экранами и функциями в [SCREENS.md §1](../design/SCREENS.md#1-маршруты).
Структура App Router:

```
app/
├── layout.tsx                          # <html>, тема без мигания, шрифт, <StoreProvider>, <Toaster>
├── not-found.tsx                       # «К сожалению, эта страница недоступна»
├── (auth)/                             # layout: вошедшего → redirect('/')
│   └── accounts/
│       ├── login/page.tsx
│       ├── emailsignup/page.tsx        # регистрация → ввод кода
│       ├── password/reset/page.tsx     # запрос и новый пароль (?token=)
│       └── oauth/complete/page.tsx     # имя пользователя и дата рождения после соцвхода
└── (main)/                             # layout: serverFetch('/me') → 401 ? redirect('/accounts/login') : оболочка
    ├── layout.tsx                      # боковое меню / мобильная навигация, слот @modal, звонки, сокет
    ├── @modal/                         # параллельный слот для окон поверх страницы
    │   ├── (.)p/[shortcode]/page.tsx   # пост, открытый из сетки или ленты (перехват маршрута)
    │   ├── (...)[username]/followers/page.tsx
    │   └── default.tsx
    ├── page.tsx                        # главная
    ├── explore/page.tsx
    ├── explore/tags/[tag]/page.tsx
    ├── explore/locations/[id]/[slug]/page.tsx
    ├── reels/page.tsx
    ├── reel/[shortcode]/page.tsx
    ├── p/[shortcode]/page.tsx          # пост при прямом переходе
    ├── stories/[username]/[storyId]/page.tsx
    ├── stories/highlights/[id]/page.tsx
    ├── direct/inbox/page.tsx
    ├── direct/requests/page.tsx
    ├── direct/t/[chatId]/page.tsx
    ├── accounts/edit/page.tsx
    ├── accounts/settings/[section]/page.tsx
    ├── archive/[kind]/page.tsx         # stories | posts
    ├── admin/[section]/page.tsx        # только ADMIN (проверка роли в layout + на backend)
    └── [username]/                     # профиль; статичные сегменты выше имеют приоритет
        ├── layout.tsx                  # шапка профиля и вкладки
        ├── page.tsx                    # публикации
        ├── reels/page.tsx
        ├── tagged/page.tsx
        ├── saved/page.tsx
        ├── saved/[collection]/page.tsx
        ├── followers/page.tsx
        └── following/page.tsx
```

**Окна поверх страницы (F-UX-03).** Как в Instagram, пост из сетки открывается окном, а URL меняется на
`/p/{shortcode}/`; обновление страницы или прямая ссылка открывают полную страницу поста. Это делают стандартные
механизмы Next.js — **параллельный слот** `@modal` и **перехват маршрута** `(.)p/[shortcode]`. Оба файла
(`@modal/(.)p/…` и `p/…`) рендерят один и тот же Client Component `PostDetails`. Закрытие окна — `router.back()`.

Имена пользователей не могут совпадать с зарезервированными сегментами (`explore`, `reels`, `direct`, `accounts`,
`stories`, `p`, `reel`, `archive`, `admin`, `api`) — список проверяет backend при регистрации и смене имени.

## 3. Шаблон страницы

```tsx
// app/(main)/p/[postId]/page.tsx — Server Component: только параметры маршрута и сборка
export default async function PostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  return <PostDetails postId={postId} />;
}

// features/posts/components/post-details.tsx — Client Component: данные и действия
'use client';
export function PostDetails({ postId }: { postId: string }) {
  const { data: post, isLoading, error, refetch } = useGetPostQuery(postId);

  if (isLoading) return <PostDetailsSkeleton />;
  if (error) {
    const apiError = getApiError(error);
    if (apiError.status === 404) return <EmptyState text="Публикация недоступна" />;
    return <ErrorState onRetry={refetch} />;
  }
  return <PostView post={post!} />;   // лайк, комментарии, удаление — мутации RTK Query внутри
}
```

Правила:

1. `page.tsx` — Server Component без загрузки данных: получает параметры и рендерит Client Component функции.
2. Client Component функции обрабатывает три состояния: загрузка (skeleton), ошибка (`404` — понятный текст,
   остальное — «Повторить»), данные.
3. `loading.tsx` нужен только сегментам, где layout делает `serverFetch` (то есть `(main)` и `(auth)`).
4. Страница «не найдено» для несуществующего поста — состояние компонента, а не `notFound()`, потому что
   данные приходят на клиенте.

## 4. Кэширование

- `serverFetch` — всегда `cache: 'no-store'`: ответ `/me` персональный.
- Статической генерации страниц с данными нет.
- Кэш данных в браузере — только RTK Query (время хранения неиспользуемых данных — 60 с по умолчанию;
  обновление — теги, см. API_REQUEST_ARCHITECTURE.md §6.3).

## 5. Компоненты и shadcn/ui

- `components/ui/` — компоненты shadcn/ui, добавляются CLI **по мере необходимости** (без генерации
  полного набора заранее). Правки в них минимальны и объясняются в PR.
- `components/layout/` — оболочка приложения (навигация, боковая панель, мобильное меню).
- `components/states/` — общие `EmptyState`, `ErrorState` (с кнопкой «Повторить»), базовые skeleton'ы.
- Компоненты функции — в `features/<name>/components/`. Компонент переезжает в общий каталог,
  только когда он нужен второй функции.
- Формы: компонент Form из shadcn/ui (react-hook-form + zod) — только проверки для удобства пользователя;
  ошибки сервера отображаются у полей.
- Визуальное направление (цвета, тёмная тема) — утверждается до Phase 2; до этого — тема shadcn по умолчанию.
- Язык интерфейса — Q2.
