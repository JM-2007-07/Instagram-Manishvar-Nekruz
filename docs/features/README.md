# Спецификации функций

Каждая спецификация описывает поведение функции для **обоих** приложений. Перед реализацией читается вместе с
[каталогом функций](../product/FEATURE_CATALOG.md), файлом эндпоинтов модуля в [api/endpoints/](../api/API_CONTRACT.md#2-эндпоинты-по-модулям),
[DATA_MODEL.md](../database/DATA_MODEL.md) и экранами в [design/SCREENS.md](../design/SCREENS.md).

| Спецификация | Функции | Модуль backend | Статус |
|---|---|---|---|
| [auth.md](auth.md) | F-ACC-* | `auth` | ✅ |
| [users-and-profiles.md](users-and-profiles.md) | F-PRF-* | `users` | ✅ |
| [follows.md](follows.md) | F-SOC-* | `follows` | ✅ |
| [privacy-and-safety.md](privacy-and-safety.md) | F-PRV-* | `privacy` | ✅ |
| [posts.md](posts.md) | F-PST-*, F-FED-*, F-REL-* | `posts` | ✅ |
| [post-interactions.md](post-interactions.md) | F-INT-* | `posts`, `comments`, `collections` | ✅ |
| [stories.md](stories.md) | F-STR-* | `stories` | ✅ (Q30) |
| [chat.md](chat.md) | F-DM-* | `chats` | ✅ |
| [calls.md](calls.md) | F-CAL-* | `calls` | ✅ (Q34) |
| [search-and-explore.md](search-and-explore.md) | F-SRC-01…03 | `search` | ✅ |
| [hashtags-and-mentions.md](hashtags-and-mentions.md) | F-TAG-*, F-SRC-04 | `tags` | ✅ |
| [notifications.md](notifications.md) | F-NTF-* | `notifications` | ✅ |
| [settings.md](settings.md) | F-SET-* | `settings` | ✅ |
| [locations.md](locations.md) | F-PST-07, F-SRC-05, F-MOD-03 | `locations` | ✅ |
| [moderation.md](moderation.md) | F-PRV-11, F-MOD-* | `admin` | ✅ |

Владельцы модулей назначаются в [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) (следующий шаг — Q26).
Медиа (`media`, `storage`) — сквозной механизм: [endpoints/media.md](../api/endpoints/media.md), ADR 0007 и 0016.

Структура каждой спецификации: назначение → сценарии → данные → права → валидация → ошибки и пустые состояния →
зависимости → критерии приёмки → открытые вопросы.
