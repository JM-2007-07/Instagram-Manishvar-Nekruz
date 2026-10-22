# 0004. Same-origin прокси через Next.js rewrites

- Статус: Принято (с обязательной проверкой в Phase 0)
- Дата: 2026-10-20

## Контекст

Cookie сессии ставит NestJS. Если браузер обращается к NestJS на другом origin, нужны CORS с credentials,
особые настройки `SameSite` и более сложная защита от CSRF.

## Решение

Браузер обращается только к origin Next.js. Правило `rewrites` в `next.config.ts` пересылает `/api/*`
в NestJS (`API_INTERNAL_URL`). Server Components обращаются к NestJS напрямую, пересылая cookie пользователя.

## Рассмотренные альтернативы

- **Прямые запросы к NestJS с CORS** — сложнее конфигурация cookie и CSRF, разные адреса в dev/prod.
- **BFF на Route Handlers** — дублирование маршрутов и риск переноса логики в Next.js.

Сравнение: [API_REQUEST_ARCHITECTURE.md §2](../architecture/API_REQUEST_ARCHITECTURE.md#2-как-браузер-достигает-nestjs-сравнение-вариантов).

## Последствия

- CORS не нужен; cookie — первого лица.
- **Проверить в Phase 0:** прохождение `Set-Cookie`, `Origin` и больших `multipart` через rewrite.
  При проблеме — один потоковый Route Handler `app/api/[...path]/route.ts` (обновить этот ADR).
- В продакшене возможна замена rewrite на обратный прокси (nginx/Caddy) — Q24.

## Проверка (T0.5, 2026-10-22)

Стенд: `next build` + `next start -p 3100` (Next.js 16.4.2) с `API_INTERNAL_URL=http://localhost:4000`; вместо NestJS —
временный Node-сервер на порту 4000, который логирует заголовки и считает байты тела. Запросы — `curl`.

| Что | Результат |
|---|---|
| `Set-Cookie: sid=abc; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600` | доходит до клиента без изменений |
| `Origin` и `Cookie` браузера | доходят до API без изменений |
| `multipart` 650 МБ (681 574 611 байт) с настройкой по умолчанию | **не проходит**: Next буферизует тело только до 10 МБ (`Request body exceeded 10MB`), API ждёт остаток, через 30 с — `socket hang up`, клиент получает 500. Так же падает файл 20 МБ |
| то же, `experimental.proxyClientMaxBodySize: '700mb'` + `proxyTimeout: 10 мин` | проходит полностью: API получил все 681 574 611 байт, 200, 4,5 с |
| `/api/v1/ping/` (слэш в конце) | Next отвечает `308` на `/api/v1/ping` до проксирования; клиент всегда ходит без слэша |

Причина лимита: в проекте есть `proxy.ts` (middleware), и Next клонирует тело запроса для него; лимит действует и на пути `/api/*`,
хотя matcher их исключает.

**Решение:** оставить `rewrites` (Route Handler не нужен). В `next.config.ts` добавлены `experimental.proxyClientMaxBodySize`
(`700mb`) и `proxyTimeout` (10 мин). Значение лимита должно быть не меньше максимального размера файла в Q (видео/рилс)
и согласовано с лимитом NestJS; при изменении лимитов медиа — обновить оба места.

**Не проверено:** реальный NestJS (cookie с `__Host-` и `Secure` — только по HTTPS; настоящий `multipart`-парсер API),
поведение за обратным прокси в продакшене (Q24), загрузка из браузера с прогрессом (`uploadMedia`), память Next при
параллельных больших загрузках, ответ при превышении 700 МБ.
