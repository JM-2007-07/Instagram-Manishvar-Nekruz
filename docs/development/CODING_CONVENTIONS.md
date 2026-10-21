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
- Пагинация — общий `PaginationQueryDto` (`page`, `limit`) из `common/`.
- Ответы описываются DTO-классами с `@ApiProperty`, чтобы Swagger и сгенерированные типы были полными.

### 2.5 Конфигурация и логи
- Переменные окружения читаются только через модуль `config` (валидация при старте), не через `process.env` в коде модулей.
- `Logger` NestJS с именем класса; не логировать пароли, токены, cookie, тексты сообщений.

## 3. Frontend (Next.js)

### 3.1 Структура функции

```
src/features/posts/
├── api.ts                 # ключи запросов, функции запросов, хуки TanStack Query
├── schemas.ts             # zod-схемы форм (только проверки для удобства)
└── components/
    ├── post-card.tsx
    ├── post-details.tsx
    └── create-post-form.tsx
```

### 3.2 `api.ts` — образец формы

```ts
export const postKeys = {
  detail: (postId: string) => ['posts', postId] as const,
  comments: (postId: string) => ['posts', postId, 'comments'] as const,
};

export function usePost(postId: string, options?: { initialData?: Post }) {
  return useQuery({
    queryKey: postKeys.detail(postId),
    queryFn: async () => unwrap(await api.GET('/posts/{postId}', { params: { path: { postId } } })),
    initialData: options?.initialData,
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) =>
      unwrap(await api.DELETE('/posts/{postId}', { params: { path: { postId } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });
}
```

`unwrap` (в `lib/api/errors.ts`) возвращает `data` или бросает `ApiError`. Типы `Post` и др. —
из сгенерированного `schema.d.ts`, не объявляются вручную.

### 3.3 Компоненты
- Server Component по умолчанию; `'use client'` — только для интерактивности.
- Компонент не вызывает `api` и `fetch` напрямую — только хуки из `features/<name>/api.ts`.
- Каждый компонент со списком/данными обрабатывает: загрузку (skeleton), пусто, ошибку.
- UI-примитивы — из `components/ui` (shadcn/ui); стили — классы Tailwind, без отдельных CSS-файлов на компонент.
- Пользовательский текст выводится как текст; `dangerouslySetInnerHTML` запрещён.

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
