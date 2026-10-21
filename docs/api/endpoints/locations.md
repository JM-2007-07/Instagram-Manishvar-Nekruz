# Эндпоинты: `locations`

> Модуль `locations` · функции F-PST-07, F-SRC-05, F-MOD-03 · спецификация [features/locations.md](../../features/locations.md).

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F / # |
|---|---|---|---|---|---|
| `GET /locations` | User | `?q&city&state&zipCode&country&cursor` | `Page<Location>` | 400 | F-PST-07 / #16 |
| `GET /locations/{locationId}` | User | — | `Location & { postCount }` | 404 | F-SRC-05 / #17 |
| `GET /locations/{locationId}/posts` | User | `?tab=TOP\|RECENT&cursor` | `Page<Post>` (только видимые) | 404 | F-SRC-05 |
| `POST /locations` | Admin | `{ name, city, state?, zipCode?, country, latitude?, longitude? }` | `201 Location` (`slug` генерируется) | 400, 403, 409 | F-MOD-03 / #18 |
| `PATCH /locations/{locationId}` | Admin | любые поля | `Location` | 400, 403, 404 | F-MOD-03 / #19 |
| `DELETE /locations/{locationId}` | Admin | — | `204` (у публикаций и стикеров место снимается) | 403, 404 | F-MOD-03 / #20 |

Справочник наполняется seed-скриптом (города, популярные места) и администратором.
