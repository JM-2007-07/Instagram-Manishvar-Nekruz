# Стратегия рендеринга (Next.js App Router)

> Статус: ✅ согласовано. Принцип: **Server Components по умолчанию, Client Components там, где нужна интерактивность.**
> Никаких лишних серверных слоёв.

## 1. Кто за что отвечает

| Часть Next.js | Используем для | Не используем для |
|---|---|---|
| **Server Components** | страницы и layout'ы; первичная загрузка данных (`GET`) через `serverApi()`; проверка входа в layout `(main)` | изменения данных, состояние UI, обработчики событий |
| **Client Components** (`'use client'`) | формы, кнопки действий (лайк, подписка), ленты с подгрузкой, чат, модальные окна; запросы через TanStack Query | прямой доступ к env сервера, чтение cookie |
| **Route Handlers** (`app/**/route.ts`) | **не используются** — прокси `/api/*` делает rewrite. Исключение — запасной вариант прокси (см. API_REQUEST_ARCHITECTURE.md §2) | дублирование API NestJS |
| **Server Actions** | **не используются** | изменения данных идут через TanStack Query → `/api/v1` |
| **`proxy.ts`** (в Next.js 16 так называется бывший `middleware.ts`) | редирект на `/login`, если нет cookie сессии | настоящую проверку сессии и прав |
| **Backend NestJS** | вся бизнес-логика, права, данные | — |

## 2. Маршруты (черновик 📝)

```
app/
├── layout.tsx                    # <html>, шрифты, Providers (QueryClientProvider, Toaster)
├── (auth)/                       # без оболочки приложения; если пользователь вошёл — редирект на /
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx   # token берётся из query ссылки в письме
└── (main)/
    ├── layout.tsx                # Server: GET /me → 401 ? redirect('/login') : оболочка с навигацией
    ├── page.tsx                  # лента: сторис сверху + /feed
    ├── explore/page.tsx          # GET /posts (+ поиск постов — Q28)
    ├── reels/page.tsx            # Q10
    ├── search/page.tsx           # поиск пользователей + история поиска
    ├── p/[postId]/page.tsx       # пост с комментариями
    ├── users/[userId]/page.tsx   # профиль (адрес по userName — Q5)
    ├── users/[userId]/followers/page.tsx
    ├── users/[userId]/following/page.tsx
    ├── stories/[userId]/page.tsx # просмотр сторис
    ├── create/page.tsx           # новый пост / сторис
    ├── saved/page.tsx            # избранное
    ├── messages/page.tsx         # список чатов
    ├── messages/[chatId]/page.tsx
    └── settings/
        ├── profile/page.tsx      # о себе, пол, аватар
        └── account/page.tsx      # смена пароля, удаление аккаунта
```

Каждый сегмент с серверной загрузкой может иметь `loading.tsx` (skeleton) и `error.tsx`. Глобальный `not-found.tsx`.

## 3. Шаблон страницы

```tsx
// app/(main)/p/[postId]/page.tsx — Server Component (иллюстрация)
export default async function PostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const api = await serverApi();
  const { data, response } = await api.GET('/posts/{postId}', { params: { path: { postId } } });
  if (response.status === 404) notFound();
  return <PostDetails initialPost={data!} />;   // Client Component
}

// features/posts/components/post-details.tsx — Client Component
'use client';
export function PostDetails({ initialPost }: { initialPost: Post }) {
  const { data: post } = usePost(initialPost.id, { initialData: initialPost });
  // лайк, комментарии, удаление — мутации TanStack Query
}
```

Правило: Server Component загружает данные **один раз** и отдаёт их как `initialData`;
дальше этими данными владеет TanStack Query (обновление, инвалидация). Одни и те же данные
не загружаются двумя разными способами.

Списки с бесконечной прокруткой (лента, комментарии, сообщения) загружаются полностью на клиенте —
первая страница может приходить как `initialData`, если это заметно улучшает первый показ.

## 4. Кэширование Next.js

- Все запросы к API с данными пользователя — `cache: 'no-store'`: они персональные.
- Статической генерации страниц с данными нет; статичны только страницы `(auth)`.
- Кэширование ответов на стороне клиента — забота TanStack Query (`staleTime` ~30 с по умолчанию 📝).

## 5. Компоненты и shadcn/ui

- `components/ui/` — компоненты shadcn/ui, добавляются CLI **по мере необходимости** (без генерации
  полного набора заранее). Правки в них минимальны и объясняются в PR.
- `components/layout/` — оболочка приложения (навигация, боковая панель, мобильное меню).
- Компоненты функции — в `features/<name>/components/`. Компонент переезжает в общий каталог,
  только когда он нужен второй функции.
- Формы: компонент Form из shadcn/ui (react-hook-form + zod) — только проверки для удобства пользователя;
  ошибки сервера отображаются у полей.
- Визуальное направление (цвета, тёмная тема) — утверждается до Phase 2; до этого — тема shadcn по умолчанию.
- Язык интерфейса — Q2.
