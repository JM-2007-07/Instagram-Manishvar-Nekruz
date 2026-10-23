# 2026-10-23 10:31 — уведомления о комментариях больше не склеиваются; «Просмотрено» сразу при открытии чата

| | |
|---|---|
| Задача | исправления после наполнения демо-данными (модули notifications и chats, Студент A) |
| Фаза | Phase 1–2 |
| Автор | Claude Code (оркестратор, Opus 5.5) по запросу Студента A |
| Агенты | — |
| Ветка, коммиты | `feat/web-a` · коммит с этой историей |

## Запрос
Два комментария разных людей к одной публикации показывались одним уведомлением («carol и bob оставил(а)
комментарий» с текстом одного), а «Просмотрено» в чате появлялось только после события в реальном времени.

## Что сделано
- **Уведомления:** объектом группировки для комментария считалась публикация (`postId ?? commentId`). Теперь
  объединяются только действия без своего текста: `POST_LIKE` — по посту, `COMMENT_LIKE` — по комментарию
  (раньше лайки разных комментариев одного поста тоже склеились бы). Комментарии, ответы, упоминания и отметки —
  каждый отдельной строкой, как у Instagram. Уточнён критерий в `docs/features/notifications.md`.
- **Контракт (с согласия Студента A):** `ChatParticipantDto.lastReadMessageId` — до какого сообщения участник
  прочитал чат (поле уже было в БД, `ChatParticipant.lastReadMessageId`). Пока чат у участника в запросах, другим
  отдаётся `null` — то же правило, что у события `chat:read`. `npm run contract` → `openapi.json`, `schema.d.ts`;
  правило записано в `docs/api/endpoints/chats.md`.
- **Сайт:** «Просмотрено» считается по `participants[].lastReadMessageId`, события `chat:read` накладываются поверх
  (`receiptsFromParticipants` в `chat-view.tsx`).

## Решения и почему
- Поле только добавлено: старые ответы и схема БД не меняются, часть Студента B не затронута.

## Изменённые файлы
- `apps/api/src/notifications/notifications.service.ts`, `apps/api/test/notifications.e2e-spec.ts` (+2 теста)
- `apps/api/src/chats/{chat.presenter,dto/chats.dto}.ts`, `apps/api/test/chats.e2e-spec.ts` (проверки поля)
- `apps/web/src/features/direct/components/chat-view.tsx`, `message-bubble.test.tsx` (+1 тест)
- `docs/api/openapi.json`, `apps/web/src/lib/api/schema.d.ts` (сгенерировано), `docs/api/endpoints/chats.md`, `docs/features/notifications.md`

## Проверка
- `npm run test:e2e -w api -- notifications` → 18 пройдено; `-- chats` → 28 пройдено
- `npm run test -w api` → 65; `npm run test -w web` → 114; lint и typecheck web и api → без ошибок
- в браузере: 4 отдельных уведомления о комментариях; «Просмотрено» под последним сообщением сразу после открытия чата
- `npm run test:e2e -w api` (полный набор) → 568 пройдено, 3 пропущено

## Проблемы и отклонения
- —

## Открытые вопросы
- —

## Что дальше
- —
