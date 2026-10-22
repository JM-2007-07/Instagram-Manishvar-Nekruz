# 2026-10-21 19:14 — Переход на RTK Query для запросов frontend

| | |
|---|---|
| Задача | — (Phase −1, архитектура frontend) |
| Фаза | −1 |
| Автор | Claude Code (оркестратор, Opus) по запросу Студента A |
| Агенты | — |
| Ветка, коммиты | `docs/npm-and-agent-docs` · коммит с этой историей |

## Запрос
Использовать для запросов RTK Query с максимально простым и понятным кодом и логикой — и сделать это максимально качественно.

## Что сделано
- ADR 0010 «RTK Query» заменяет ADR 0005 (TanStack Query + openapi-fetch); ADR 0005 помечен «Заменено».
- `API_REQUEST_ARCHITECTURE.md` переписан: устройство `lib/api` (один `baseApi`, store, `StoreProvider`, `types.ts`,
  `serverFetch`), образцы эндпоинтов (`query`, `infiniteQuery`, `mutation`), таблица тегов для всех запросов и мутаций,
  пагинация, опрос чата, оптимистичные лайки во всех кэшах, ошибки, загрузка файлов, контроль соответствия контракту.
- `RENDERING_STRATEGY.md`: Server Components — оболочка и проверка сессии; данные страниц — RTK Query в Client Components.
- `CODING_CONVENTIONS.md` §3: структура функции, короткий образец `api.ts`, правила однообразия, мутация в компоненте.
- Обновлены: `AGENTS.md` (жёсткие правила), агенты `frontend-dev` (переписан), `reviewer`, `contract-designer`,
  `AUTHENTICATION.md` §5, `ARCHITECTURE.md`, `apps/web/README.md`, `README.md`, `GLOSSARY.md`, `IMPLEMENTATION_PLAN.md` (T0.3),
  `ROADMAP.md`, `QUALITY_CHECKLIST.md`, `features/notifications.md`, `docs/README.md`, `decisions/README.md`.

## Решения и почему
- **Эндпоинты пишутся вручную** через `injectEndpoints`, типы — псевдонимы сгенерированных из Swagger.
  Кодогенерация `@rtk-query/codegen-openapi` отвергнута: длинные имена хуков и большой сгенерированный файл хуже
  читаются студентом (ADR 0010).
- **Один путь загрузки данных — клиентский.** Все страницы закрыты входом, SEO не нужен; загрузка на сервере
  потребовала бы второго пути и гидратации кэша RTK Query.
- **Инвалидация тегами** по единой таблице — понятнее, чем ручные ключи; оптимистичные обновления только для
  лайков и избранного.
- **401:** перенаправление на `/login` только при коде `UNAUTHENTICATED`, иначе неверный пароль на форме входа
  тоже вызвал бы переход.
- **Store** создаётся в `StoreProvider` (не глобальная переменная модуля) — иначе на сервере Next.js он был бы общим для всех.
- **Без автоматических повторов** запросов: кнопка «Повторить» проще и предсказуемее.

## Изменённые файлы
- Новые: `docs/decisions/0010-rtk-query.md`, эта история. Дополнение в конце ADR 0006 (что `typecheck` больше не проверяет URL).
- Изменены: см. «Что сделано».

## Проверка
- API RTK Query сверены с типами пакета `@reduxjs/toolkit` 2.13.0 (скачан `npm pack` во временный каталог):
  `infiniteQuery` (`initialPageParam`, `getNextPageParam`, хуки `use…InfiniteQuery`, `fetchNextPage`, `hasNextPage`),
  `injectEndpoints`, `providesTags`/`invalidatesTags`, `updateQueryData`, `selectCachedArgsForQuery`,
  `resetApiState`, `pollingInterval`, `skipPollingIfUnfocused` — присутствуют. react-redux — 9.3.0.
- Поиск `TanStack|openapi-fetch|QueryClient|initialData|serverApi`: остались только в ADR 0005/0010, сравнении
  вариантов и списках запрещённых библиотек.
- Скрипт проверки ссылок: 300 ссылок, ошибок 0.
- ⚠️ Образцы кода не компилировались (приложения ещё нет) — проверка в T0.3.

## Проблемы и отклонения
- URL эндпоинтов RTK Query не проверяются компилятором (в отличие от openapi-fetch). Компенсация: сверка `reviewer`
  с API_CONTRACT.md и e2e-сценарии Playwright (T5.2).

## Что дальше
- PR ветки в `main`; ответ на Q26; T0.3 — каркас Next.js с `baseApi`, store и `StoreProvider`.
