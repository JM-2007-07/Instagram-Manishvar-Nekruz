# Спецификации функций

Каждая спецификация описывает поведение функции для **обоих** приложений. Перед реализацией читается вместе с
[каталогом функций](../product/FEATURE_CATALOG.md), файлом эндпоинтов модуля в [api/endpoints/](../api/API_CONTRACT.md#2-эндпоинты-по-модулям),
[DATA_MODEL.md](../database/DATA_MODEL.md) и экранами в [design/SCREENS.md](../design/SCREENS.md).

| Спецификация | Функции | Модуль backend | Владелец | Статус |
|---|---|---|---|---|
| [auth.md](auth.md) | F-ACC-* | `auth` | A (backend), B (страницы) | ✅ |
| [users-and-profiles.md](users-and-profiles.md) | F-PRF-* | `users` | A (backend), B (страницы) | ✅ |
| [follows.md](follows.md) | F-SOC-* | `follows` | A | ✅ |
| [privacy-and-safety.md](privacy-and-safety.md) | F-PRV-* | `privacy` | A | ✅ |
| [posts.md](posts.md) | F-PST-*, F-FED-*, F-REL-* | `posts` | B (лента Reels — A) | ✅ |
| [post-interactions.md](post-interactions.md) | F-INT-* | `posts`, `comments`, `collections` | B (комментарии — A) | ✅ |
| [stories.md](stories.md) | F-STR-* | `stories` | B | ✅ (Q30) |
| [chat.md](chat.md) | F-DM-* | `chats` | A | ✅ |
| [calls.md](calls.md) | F-CAL-* | `calls` | A | ✅ (Q34) |
| [search-and-explore.md](search-and-explore.md) | F-SRC-01…03 | `search` | A («Интересное» — B) | ✅ |
| [hashtags-and-mentions.md](hashtags-and-mentions.md) | F-TAG-*, F-SRC-04 | `tags` | B | ✅ |
| [notifications.md](notifications.md) | F-NTF-* | `notifications` | A | ✅ |
| [settings.md](settings.md) | F-SET-* | `settings` | A | ✅ |
| [locations.md](locations.md) | F-PST-07, F-SRC-05, F-MOD-03 | `locations` | B | ✅ |
| [moderation.md](moderation.md) | F-PRV-11, F-MOD-* | `admin` | B | ✅ |

Владельцы модулей — [IMPLEMENTATION_PLAN.md §2.2](../IMPLEMENTATION_PLAN.md#22-владельцы-модулей); ревьюер — второй студент.
Медиа (`media`, `storage`) — сквозной механизм: [endpoints/media.md](../api/endpoints/media.md), ADR 0007 и 0016.

Структура каждой спецификации: назначение → сценарии → данные → права → валидация → ошибки и пустые состояния →
зависимости → критерии приёмки → открытые вопросы.
