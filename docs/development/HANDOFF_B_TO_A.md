# Передача дел: что сделал Студент B и что нужно Студенту A (2026-10-22)

> Для Студента A (`JM-2007-07`) и его Claude Code. Продолжение [HANDOFF_A_TO_B.md](HANDOFF_A_TO_B.md).
> Статус — [STATUS.md](../STATUS.md), история — [2026-10-22_1945_backend-b](../stories/2026-10-22_1945_backend-b.md).
> Ветка B — `feat/backend-b` (от `feat/backend-a`). Ревью ещё не проводилось.

## 1. Что готово у B (backend, `apps/api`)

| Задача | Модуль / где | Состояние |
|---|---|---|
| T1.B1 `media` + `storage` | `src/media/`, `src/storage/` | готово; `s3` — T5.B2 |
| T1.B2 `tags` | `src/tags/` | готово |
| T1.B3 `locations` | `src/locations/` | готово, seed 24 места |
| T1.B4 `posts` | `src/posts/` | готово (ленты, reels, сетки, лайки, воспроизведения) |
| T1.B5 `comments` | `src/comments/` | готово (P0 + ответы, закрепление, одобрение) |
| T2.B1 `stories` + актуальное | `src/stories/` | готово |
| T2.B2 ответы на истории → Direct | `src/stories/` → `ChatsService.sendSystemMessage` | готово |
| T4.B2 комментарии P1 | `src/comments/` | backend готов |
| T4.B3 стикеры P2 | `src/stories/` | backend готов |
| T4.B4 жалобы и админ | `src/reports/`, `src/admin/` | готово |

Тесты: 65 unit; e2e B — 152 (media 25, tags + locations + posts 51, comments + stories + admin 76). Полный прогон A+B — см. история.
Все модули B `@Global`, импортировать не нужно.

## 2. Публичные сервисы B для A

| Что | Сигнатура | Где | Зачем A |
|---|---|---|---|
| Привязка медиа | `MediaService.attach(ownerId: string, mediaIds: string[], options: { target: MediaTarget; purposes: MediaPurpose[]; tx?: Prisma.TransactionClient }): Promise<void>` | `src/media/media.service.ts` | аватар, медиа в Direct, аватар группы |
| Отдача медиа | `MediaService.toMediaItem(row)` + `mediaItemSelect` (select-константа) | `src/media/media.service.ts` | `MediaItemDto` в сообщениях |
| Удаление файлов | `MediaService.removeFiles(mediaIds: string[]): Promise<void>` | `src/media/media.service.ts` | `DELETE /me/avatar`, очистка |
| Посты | `PostsService.toPostDto(row, viewerId)`, `PostsService.postSelect(viewerId)` | `src/posts/posts.service.ts`, `src/posts/post.select.ts` | «Сохранённое», «поделиться постом», превью |
| Счётчик постов | `PostsService.countByAuthor(userId: string): Promise<number>` | `src/posts/posts.service.ts` | `Profile.postCount` |
| Пост с проверкой доступа | `PostsService.findVisibleById(viewerId, postId): Promise<PostDto \| null>`, `PostsService.getById(viewerId, postId)` | `src/posts/posts.service.ts` | превью, шаринг |
| Теги | `TagsService.parse(text, limits?: ParseLimits)`, `TagsService.resolveMentions(userNames: string[], tx?)`, `TagsService.searchHashtags(query, limit)` | `src/tags/tags.service.ts` | `/search` (хэштеги) |
| Места | `LocationsService.searchForGlobal(query, limit)`; функции `toLocationDto(row)`, константа `locationSelect` | `src/locations/locations.service.ts` | `/search` (места) |
| Комментарии | `CommentsService.countByPost(viewerId, postId)`, `CommentsService.toCommentDto(row)`; функция `commentSelect(viewerId)` | `src/comments/comments.service.ts`, `src/comments/comment.select.ts` | счётчики, превью |
| Истории | `StoriesService.hasActiveStory(viewerId, userIds: string[]): Promise<Map<string, { hasActiveStory: boolean; isCloseFriendStory: boolean }>>` | `src/stories/stories.service.ts` | кольца у аватаров в `userSummarySelect` |

## 3. Что нужно сделать A (файлы A)

Это правки файлов A — делает Студент A по [CONTRIBUTING «Общие файлы»](../../CONTRIBUTING.md#общие-файлы).

| # | Что | Файлы A | Примечание |
|---|---|---|---|
| 1 | FK `User.avatarMediaId` → `MediaFile`; `PUT/DELETE /me/avatar` через `attach` / `removeFiles` | `account.prisma`, `src/users/` | миграция |
| 2 | FK `MessageMedia.mediaId`, `Chat.avatarMediaId` → `MediaFile` | `chats.prisma`, `src/chats/` | миграция |
| 3 | FK `Notification.postId` → Post, `commentId` → Comment, `storyId` → Story (Cascade) | `notifications.prisma` | миграция |
| 4 | FK `Message.sharedPostId` → Post, `Message.storyId` → Story | `chats.prisma`, `src/chats/` | миграция |
| 5 | `Profile.postCount` через `countByAuthor(userId)` | `src/users/` | вместо 0 |
| 6 | `isSavedByMe` в `toPostDto` — сейчас `false`, одно место | `src/posts/posts.service.ts` (B) | сообщить B, если меняете сами |
| 7 | `hasActiveStory` / `isCloseFriendStory` в `userSummarySelect` через `StoriesService.hasActiveStory` | `src/users/user-summary.select.ts` | функция от зрителя |
| 8 | `MessageDto.story` в ChatPresenter | `src/chats/` | — |
| 9 | Поиск хэштегов и мест в `/search`; колонки `hashtagId`, `locationId` в `SearchHistoryEntry` | `src/search/`, `search.prisma` | миграция |
| 10 | `NotificationType.STORY_LIKE` (если нужен) | `notifications.prisma` | открытый вопрос |
| 11 | `Env`: поля `STORAGE_DRIVER`, `STORAGE_LOCAL_DIR`, `FFMPEG_PATH` в классе `Env` | `src/config/env.ts` | сейчас читаются через `config.get` без валидации (`src/storage/storage.service.ts`, `src/media/media-processing.service.ts`) |
| 12 | `openapi.ts`: заглушка `DATABASE_URL` до импорта AppModule | `src/openapi.ts` | `npm run contract` без БД падает |

Внимание: `visibleCommentWhere` (`src/comments/comment.select.ts`) дублирует `visibleUserWhere` из privacy. Если меняете `visibleUserWhere` — сообщите B.

## 4. Общие файлы A, которые B изменил по правилам CONTRIBUTING

| Файл | Что изменено |
|---|---|
| `apps/api/src/app.module.ts` | строки импорта модулей B |
| `apps/api/prisma/seed.ts` | вызов `seedLocations` |
| `apps/api/prisma/schema/account.prisma` | блоки `// --- <module> (B) ---` с обратными связями на `User` |

Просьба: при ревью проверить эти три места; при конфликте при rebase сохранять обе стороны.

## 5. Правила для A

- Миграции B применены (`migrate deploy`); после rebase на `feat/backend-b` создавать свои миграции по [CHANGE_PROCESS.md](CHANGE_PROCESS.md).
- Влитые миграции не править. Схема B — в `apps/api/prisma/schema/<module>.prisma`.
- Перед изменением `userSummarySelect`, `visibleUserWhere`, `toPostDto` — предупредить B.
