# Спецификации функций

Каждая спецификация описывает поведение функции для **обоих** приложений. Перед реализацией функции
её спецификацию читают вместе с [API_CONTRACT.md](../api/API_CONTRACT.md) и [DATA_MODEL.md](../database/DATA_MODEL.md).

| Спецификация | Модуль backend | Владелец | Фаза | Статус |
|---|---|---|---|---|
| [auth.md](auth.md) | `auth` | A (UI в Phase 1 — B) | 1 | ✅ готова к реализации |
| [users-and-profiles.md](users-and-profiles.md) | `users` | A | 2 | ✅ (Q5, Q7–Q9) |
| [follows.md](follows.md) | `follows` | A | 2 | ✅ |
| [posts.md](posts.md) | `posts` | B | 2 (reels — 3) | ✅ (Q10, Q28) |
| [post-interactions.md](post-interactions.md) | `posts` | B | 3 | ✅ (Q13–Q15) |
| [stories.md](stories.md) | `stories` | B | 4 | ✅ (Q11, Q12) |
| [search-history.md](search-history.md) | `search-history` | A | 3 | ✅ |
| [locations.md](locations.md) | `locations` | A | 4 | ⚠️ назначение неясно (Q6, Q20) |
| [chat.md](chat.md) | `chats` | A | 5 | ✅ (Q16–Q19, Q29) |
| [notifications.md](notifications.md) | — | — | 6 | ❓ не согласовано (Q21) |

Медиа (`storage`, `media`) — сквозной механизм, описан в [ARCHITECTURE.md](../architecture/ARCHITECTURE.md#5-данные-и-медиа)
и [SECURITY.md](../architecture/SECURITY.md#загрузка-файлов).

Структура каждой спецификации: назначение → сценарии → API → данные → права → валидация →
ошибки и пустые состояния → зависимости → критерии приёмки → открытые вопросы.
