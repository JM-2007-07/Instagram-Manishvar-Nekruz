# 2026-10-22 15:40 — T0.4: каркас `apps/web` (Next.js, токены, RTK Query baseApi, Vitest)

| | |
|---|---|
| Задача | T0.4 |
| Фаза | 0 |
| Автор | Студент B (`nek-yt`), оркестратор Claude Code |
| Агенты | planner (Opus), frontend-dev ×4 (Sonnet), test-writer (Sonnet), verifier (Haiku), reviewer (Opus), docs-keeper (Haiku) |
| Ветка, коммиты | `feat/web-foundation` · коммит с этой историей |

## Запрос
Студент B попросил выполнить T0.4 «Каркас Next.js + токены» целиком (все этапы подряд) и так, чтобы не было
конфликтов со Студентом A: ветка от T0.1, которая ещё не в `main`; в `STATUS.md` трогать только свои строки.

## Что сделано
- Каркас `apps/web`: Next.js 16.4.2, React 19.3, Tailwind 4.3, TypeScript 5.9, RTK 2.13, react-redux 9.3.
- ESLint 9 (flat config, `eslint-config-next` 16) с правилами границ: запрет `axios`, `swr`, `openapi-fetch`,
  `zustand`, `@tanstack/*`; запрет импорта из `apps/api`; запрет необъявленных зависимостей.
- Vitest 5 + React Testing Library + jsdom; 22 теста.
- `next.config.ts`: rewrites `/api/:path*` → `API_INTERNAL_URL` (same-origin прокси, ADR 0004).
- `globals.css`: токены DESIGN_SYSTEM §2–3 и §5 для светлой и тёмной темы; связка с shadcn через `@theme inline`.
- `components.json`; `lib/utils.ts`, `lib/design.ts`, `lib/config.ts`.
- `lib/api/`: `base-api.ts` (единственный `createApi`), `types.ts`, `errors.ts`, `server.ts` (`serverFetch`),
  `upload.ts` (`uploadMedia`, XMLHttpRequest с прогрессом).
- `lib/store.ts`, `lib/store-provider.tsx`: store только с RTK Query.
- Корневой layout: тема по cookie `theme`, `StoreProvider`, `Toaster`.
- `components/ui/button.tsx`, `components/ui/sonner.tsx`; `components/layout/brand-logo.tsx`.
- Временная страница `/health` (удаляется или заменяется в T0.7).
- `apps/web/README.md` — статус и запуск.

## Решения и почему
- Типы ошибок и страницы написаны вручную: `schema.d.ts` появится только в T0.5 (генерация из контракта).
- Тема без `next-themes`: класс `dark` ставится по cookie `theme`; переключатель — в T0.7.
- `APP_NAME` = `Photogram` по умолчанию: Q31 (название) ещё открыт, см. [REQUIREMENTS §5](../REQUIREMENTS.md#5-открытые-вопросы).
- Без `API_INTERNAL_URL` конфиг только предупреждает, а не падает: `next typegen` (часть `typecheck`) загружает
  конфиг, и ошибка ломала бы typecheck и CI.
- При 401 с кодом `UNAUTHENTICATED` выполняется полная перезагрузка страницы (ADR 0004, комментарий в коммите `517b67e`).
- shadcn-компоненты написаны вручную: CLI создаёт вложенный lock-файл.
- Корневой `package.json` (владелец A) в этой задаче не менялся. Вне `apps/web` изменён только `package-lock.json`.
- Ветка создана от `origin/chore/root-tooling` (T0.1, PR #5 на ревью) с согласия пользователя; upstream снят, чтобы
  push не ушёл в ветку A. После слияния PR #5: `git rebase --onto origin/main fa4863e feat/web-foundation`.

## Изменённые файлы
- `apps/web/**` — каркас, конфиги, `src/` (см. «Что сделано»), тесты
- `apps/web/README.md` — статус, запуск
- `package-lock.json` — зависимости `apps/web`
- `docs/STATUS.md` — строка T0.4 на доске §3, строка в оглавлении §7
- `docs/stories/2026-10-22_1540_web-foundation.md` — эта история

## Коммиты
- `e61af5e` — scaffold
- `54e2f20` — ESLint и Vitest
- `e255075` — токены
- `971113c` — `lib/api` и store
- `517b67e` — комментарий о полной перезагрузке
- `0d2217a` — layout, Toaster, BrandLogo, `/health`
- `d7db4aa` — тесты
- `8b7c9e2` — правки по ревью
- коммит с этой историей

## Проверка
- `npm ci` → без ошибок
- `npm run lint` → зелёный
- `npm run typecheck` → зелёный
- `npm run test` → 22 теста, зелёные
- `prettier --check` → зелёный
- `npm run build` с `API_INTERNAL_URL` → зелёный
- `npm audit --omit=dev` → 0 уязвимостей
- `curl /health`: без cookie — `<html lang="ru">`; с `theme=dark` — `class="dark"`
- reviewer: блокеров нет; 3 🟡 исправлены (проверка пути входа без завершающего слэша, токен `--toast`,
  цвет отключённой кнопки)
- ⚠️ не проверено визуально: обе темы в браузере при 375 px и 1150 px; показ тоста
- ⚠️ не проверено: правило ESLint против `@nestjs/common` (`apps/api` ещё пуст — повторить после T0.2)
- ⚠️ не проверено: прокси на реальном API (T0.5)

## Проблемы и отклонения
- Ветка не от `main`, а от T0.1 (см. «Решения»).
- 5 уязвимостей high в dev-цепочке `eslint-config-next` (пакет `braces`); в production их нет (`npm audit --omit=dev` = 0).
- Агент шага 4 остановил сервер через `taskkill /F /IM node.exe`, что завершило все процессы node на машине.
- Однажды `npm install` нескольких пакетов одной командой перезаписал production-зависимости; повторено отдельно.

## Открытые вопросы
- `/health` занимает имя пользователя `health`: убрать в T0.7 или зарезервировать (сообщить Студенту A).
- Расхождения в документах, которые нужно поправить отдельным docs-PR:
  - ADR 0010: T0.3 → T0.4, `/login` → `/accounts/login/`;
  - RENDERING_STRATEGY §5: тема shadcn по умолчанию (Q2);
  - API_REQUEST_ARCHITECTURE §4.3: только сгенерированные типы;
  - `components/states` не назначен ни в одной задаче;
  - CODING_CONVENTIONS §2.4: `page`/`limit` против курсорной пагинации ADR 0017.
- `API_INTERNAL_URL` нужен и на этапе `next build` (rewrites попадают в routes-manifest): учесть в T0.6 и T5.A1.

## Что дальше
- Ручной осмотр `/health` в обеих темах (⚠️ выше).
- После слияния PR #5 в `main`: rebase на `origin/main`, push и PR T0.4 — по просьбе пользователя.
- Затем T0.7 (оболочка `(main)`); T0.5 — после T0.2.
