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
