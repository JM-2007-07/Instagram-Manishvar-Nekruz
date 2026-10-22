# Соглашения о коде

> Статус: ✅ согласовано (следует из ARCHITECTURE.md и ADR). Фрагменты — **образцы формы**, а не готовый код:
> точные имена и поля берутся из спецификации функции и контракта. Уточняется после Phase 0 по реальному каркасу.

## 1. Общие правила

| Тема | Правило |
|---|---|
| Язык | код, имена, API, коммиты — английский; комментарии и документация — русский или английский |
| Файлы | `kebab-case`: `posts.service.ts`, `post-card.tsx` |
| Классы, типы, компоненты | `PascalCase`: `PostsService`, `CreatePostDto`, `PostCard` |
| Функции, переменные | `camelCase`; булевы — `is/has/can`: `isLikedByMe` |
| Константы | `UPPER_SNAKE_CASE` только для настоящих констант конфигурации |
| Типы | явные типы у параметров и возвращаемых значений публичных функций; без `any` |
| Размер | функция — одна задача; файл > ~250 строк — повод разделить |
| Комментарии | объясняют **почему**, а не что; без закомментированного кода |
| Импорты | без циклов; внутри приложения — алиас `@/` для `src/` |
| Форматирование | Prettier, без ручных споров о стиле |

## 2. Backend (NestJS)

### 2.1 Структура модуля

```
src/posts/
├── posts.module.ts
├── posts.controller.ts        # HTTP: маршруты, DTO, Swagger, @CurrentUser
├── posts.service.ts           # бизнес-правила, проверка прав, Prisma
├── comments.service.ts        # отдельный сервис, если posts.service.ts разрастается
├── dto/
│   ├── create-post.dto.ts
│   ├── post-response.dto.ts
│   └── list-posts-query.dto.ts
└── posts.service.spec.ts      # юнит-тесты правил
```

Нет папок `repositories/`, `use-cases/`, `interfaces/` и т.п.: controller → service → Prisma.

### 2.2 Controller — образец формы

```ts
@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get(':postId')
  @ApiOkResponse({ type: PostResponseDto })
  findOne(@Param('postId', ParseUUIDPipe) postId: string, @CurrentUser() user: SessionUser) {
    return this.postsService.findOne(postId, user.id);
  }

  @Delete(':postId')
  @HttpCode(204)
  remove(@Param('postId', ParseUUIDPipe) postId: string, @CurrentUser() user: SessionUser) {
    return this.postsService.remove(postId, user.id);
  }
}
```

Controller не содержит `if` с бизнес-правилами и не обращается к Prisma.

### 2.3 Service — образец проверки прав

```ts
async remove(postId: string, userId: string): Promise<void> {
  const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!post) throw new NotFoundException('Post not found');
  if (post.authorId !== userId) throw new ForbiddenException('Only the author can delete this post');
  await this.prisma.post.delete({ where: { id: postId } });
  // файлы удаляются после успешного удаления записи (DATA_MODEL.md §4)
}
```

Правила:
- Сначала найти ресурс, затем проверить права, затем изменять.
- Чужие приватные ресурсы (чат, сообщение) → `NotFoundException`, а не `Forbidden`.
- Всегда `select` нужных полей; никогда не возвращать `passwordHash` и служебные поля.
- Многотабличные изменения — `this.prisma.$transaction(...)`.
- Ошибки — стандартные исключения NestJS; глобальный фильтр приводит их к формату контракта.

### 2.4 DTO — образец

```ts
export class CreateCommentDto {
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 1000)
  text!: string;
}
```

- Одно DTO — одна форма запроса или ответа. Ограничения берутся из раздела «Валидация» спецификации функции.
- Пагинация — курсорная ([ADR 0017](../decisions/0017-cursor-pagination.md)): запрос — общий `CursorQueryDto` (`cursor?`, `limit` 1–50, по умолчанию 20)
  из `common/pagination/cursor-query.dto.ts`, ответ — `{ items, nextCursor }`; курсор кодируют `encodeCursor`/`decodeCursor` из `common/pagination/cursor.ts`.
- Ответы описываются DTO-классами с `@ApiProperty`, чтобы Swagger и сгенерированные типы были полными.

### 2.5 Конфигурация и логи
- Переменные окружения читаются только через модуль `config` (валидация при старте), не через `process.env` в коде модулей.
- `Logger` NestJS с именем класса; не логировать пароли, токены, cookie, тексты сообщений.

## 3. Frontend (Next.js + RTK Query)

### 3.1 Структура функции

```
src/features/posts/
├── api.ts                 # baseApi.injectEndpoints: эндпоинты, теги, экспорт хуков
├── cache.ts               # (только posts) updatePostInCache для оптимистичных лайков и сохранения
├── realtime.ts            # (если есть события) обработчики Socket.IO → кэш RTK Query
├── schemas.ts             # zod-схемы форм (только проверки для удобства)
└── components/
    ├── post-card.tsx
    ├── post-details.tsx
    └── create-post-form.tsx
```

### 3.2 `api.ts` — образец формы

Полный образец с бесконечной лентой и оптимистичным лайком — [API_REQUEST_ARCHITECTURE.md §6.2, §6.5](../architecture/API_REQUEST_ARCHITECTURE.md#62-эндпоинты-функции--образец).
Короткая форма, которой следуют все функции:

```ts
import { baseApi } from '@/lib/api/base-api';
import type { Comment, Page } from '@/lib/api/types';

export const commentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getComments: build.infiniteQuery<Page<Comment>, string, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
      },
      query: ({ queryArg: postId, pageParam }) => ({
        url: `/posts/${postId}/comments`,
        params: { cursor: pageParam ?? undefined, limit: 20 },
      }),
      providesTags: (_result, _error, postId) => [{ type: 'Comment', id: postId }],
    }),

    createComment: build.mutation<Comment, { postId: string; text: string }>({
      query: ({ postId, text }) => ({ url: `/posts/${postId}/comments`, method: 'POST', body: { text } }),
      invalidatesTags: (_result, _error, { postId }) => [
        { type: 'Comment', id: postId },
        { type: 'Post', id: postId },
      ],
    }),
  }),
});

export const { useGetCommentsInfiniteQuery, useCreateCommentMutation } = commentsApi;
```

Правила:

| Правило | Почему |
|---|---|
| Один `api.ts` на функцию, один `injectEndpoints`, хуки экспортируются в конце | одинаковая форма во всех функциях |
| Имена: `getX` для чтения, глагол для изменения (`createComment`, `likePost`, `followUser`) | по имени понятно, запрос это или мутация |
| `query` возвращает только URL, метод, `params`, `body` — без логики | логика — в backend |
| Каждый запрос — `providesTags`, каждая мутация — `invalidatesTags` по таблице API_REQUEST_ARCHITECTURE.md §6.3 | данные не устаревают |
| Типы — только из `@/lib/api/types` | типы совпадают со Swagger |
| `onQueryStarted` с `updateQueryData` — только лайки, сохранение, сообщения и реакции (API_REQUEST_ARCHITECTURE.md §6.5) | остальное проще и надёжнее через теги |
| Списки — `infiniteQuery` с курсором: `initialPageParam: null`, `getNextPageParam: (last) => last.nextCursor ?? undefined` | ADR 0017 |
| Загрузка файлов — только `uploadMedia()` из `lib/api/upload.ts`, затем мутация с `mediaIds` | прогресс загрузки (§9) |
| Никаких `fetch`, `axios`, `useEffect` для загрузки данных | один способ запросов |

### 3.3 Мутация в компоненте

```tsx
'use client';
export function CommentForm({ postId }: { postId: string }) {
  const [createComment, { isLoading }] = useCreateCommentMutation();

  async function handleSubmit(values: { text: string }) {
    try {
      await createComment({ postId, text: values.text }).unwrap();   // unwrap: ошибка → catch
      form.reset();
    } catch (error) {
      showApiError(error, form);   // VALIDATION_ERROR → у полей, остальное → toast
    }
  }
  // …разметка формы; кнопка disabled={isLoading}
}
```

### 3.4 Компоненты
- `page.tsx` — Server Component без загрузки данных; данные — в Client Component функции через хуки RTK Query.
- Компонент не вызывает `fetch` и не обращается к store напрямую — только хуки из `features/<name>/api.ts`.
- Каждый компонент с данными обрабатывает: загрузку (skeleton), пусто (текст из спецификации), ошибку («Повторить»).
- UI-примитивы — из `components/ui` (shadcn/ui); стили — классы Tailwind, без отдельных CSS-файлов на компонент.
- Локальное состояние UI — `useState`; Redux store содержит только кэш RTK Query.
- Пользовательский текст выводится как текст; `dangerouslySetInnerHTML` запрещён. Хэштеги и упоминания в тексте
  превращаются в ссылки одним компонентом `RichText` (разбор строки → массив текст/ссылка), без HTML.

### 3.5 Дизайн
- Цвета, шрифты, размеры, анимации — **только токены** из [DESIGN_SYSTEM.md](../design/DESIGN_SYSTEM.md)
  (`bg-background`, `text-muted-foreground`); «сырые» `#…` в компонентах запрещены.
- Повторяющиеся размеры (ширина ленты 630, карточки 470, меню 72/238, сетка 3:4) — константы в `src/lib/design.ts`.
- Иконки — `lucide-react`, 24 px; логотип и название — компонент `BrandLogo` и `APP_NAME` из конфигурации.
- Каждый экран сверяется с [SCREENS.md](../design/SCREENS.md) в светлой и тёмной теме и на ширине 375 / 1150 px.

## 4. Тесты

| Что | Имя файла | Название теста |
|---|---|---|
| юнит backend | `<name>.service.spec.ts` рядом с сервисом | `it('forbids deleting another user's post')` |
| e2e API | `test/<module>.e2e-spec.ts` | `it('DELETE /posts/:id returns 403 for non-author')` |
| frontend | `<component>.test.tsx` рядом с компонентом | `it('shows error when like fails')` |

Тест проверяет поведение из спецификации функции; один тест — одно поведение.

## 5. Git

Ветки, коммиты, PR — [CONTRIBUTING.md](../../CONTRIBUTING.md). Коротко: `feat/<module>-<short>`,
Conventional Commits на английском, PR с шаблоном и ревью второго студента.
