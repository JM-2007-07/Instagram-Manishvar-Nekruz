# Эндпоинты: `search`

> Модуль `search` · функции F-SRC-01…03, F-TAG-03 · спецификация [features/search-and-explore.md](../../features/search-and-explore.md).
> «Интересное» (`GET /explore`) — в [posts.md](posts.md); страницы хэштега и места — [tags.md](tags.md), [locations.md](locations.md).

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F / # |
|---|---|---|---|---|---|
| `GET /search` | User | `?q` (1–50) | `{ users: UserSummary[], hashtags: Hashtag[], locations: Location[] }` — по 10 📝 | 400 | F-SRC-02 |
| `GET /search/users` | User | `?q&cursor` — по `userName` и `fullName`, подписки выше | `Page<UserSummary & { followStatus }>` | 400 | F-SRC-02 / #41 |
| `GET /search/hashtags` | User | `?q&cursor` | `Page<Hashtag>` | 400 | F-SRC-02, F-TAG-03 |
| `GET /search/locations` | User | `?q&cursor` | `Page<Location>` | 400 | F-SRC-02 |
| `GET /search/mentions` | User | `?q` | `UserSummary[]` (до 10) — подсказка после `@` | 400 | F-TAG-03 |
| `GET /me/search-history` | User | `?type=QUERY\|USER\|HASHTAG\|LOCATION&cursor` (без `type` — все) | `Page<{ id, type, query?, user?, hashtag?, location?, createdAt }>` | — | F-SRC-03 / #43, #47 |
| `POST /me/search-history` | User | `{ type, query? , userId?, hashtagName?, locationId? }` | `201` запись (повтор поднимает существующую) | 400, 404 | F-SRC-03 / #42, #46 |
| `DELETE /me/search-history/{entryId}` | Owner | — | `204` | 404 | F-SRC-03 / #44, #48 |
| `DELETE /me/search-history` | User | `?type` (без — все) | `204` | — | F-SRC-03 / #45, #49 |

Поиск по email не выполняется (P9). Заблокированные в обе стороны в результатах не появляются.
