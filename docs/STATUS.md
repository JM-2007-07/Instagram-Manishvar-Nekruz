# STATUS — текущее состояние проекта

> Статус: живой документ. **Обновляется в каждом PR**, который меняет состояние задач.
> Последнее обновление: 2026-10-23 14:00.
> План (что, в каком порядке, кто) — в [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md); здесь — только состояние.

## 1. Коротко

| | |
|---|---|
| **Текущая фаза** | Phase −1 завершена; **Phase 0 «Общий фундамент» — в работе** (T0.1 на ревью; T0.2+ в `feat/backend-a`) |
| **Подход** | backend-first, два независимых потока; frontend каждый начинает на своей точке (MA-1 / MB-1) |
| **Команда** | A — `JM-2007-07` (аккаунт, люди, общение), B — `nek-yt` (контент и интерфейс); логины проверены через GitHub API |
| **Код приложений** | `apps/api` — каркас NestJS 11 + Prisma 7.10.1 в ветке `feat/backend-a` (T0.2); `apps/web` — нет |
| **Зависимости** | в корне — Prettier и `concurrently` (T0.1); **ffmpeg и Docker на машине A не установлены** |
| **Последний PR** | [PR #4](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/4) влит в `main` (`7bc09bb`); план и онбординг — в `main` |

### Следующая задача

| Студент | Задача | Ветка | Блокер |
|---|---|---|---|
| A (`JM-2007-07`) | **T0.1** на ревью ([PR #5](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/5)) → T0.2, T0.3 на ревью ([PR #6](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/6)) → T1.A1… — весь backend A в одной ветке (решение A) | `chore/root-tooling`, `feat/backend-a` | ревью B |
| B (`nek-yt`) | настройка по [ONBOARDING.md](development/ONBOARDING.md), ревью [PR #5](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/5) и [PR #6](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/6) → **T0.4** (после #5), Phase 1 (после #6, C0) | `feat/web-foundation` | #5 и #6 в `main` |

### Контрольные точки

| Точка | Состояние |
|---|---|
| C0 — фундамент готов (T0.2, T0.3) | 🟦 [PR #6](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/6) на ревью (поверх PR #5) |
| MA-1 — backend A готов для frontend A | ⬜ |
| MB-1 — backend B готов для frontend B | ⬜ |
| MA-2 — Direct готов | ⬜ |
| MB-2 — истории готовы | ⬜ |
| M-BE — backend ядра завершён | ⬜ |
| M-FE — frontend ядра завершён | ⬜ |

## 2. Что сделано

- ✅ Phase −1: исходный Swagger изучен (57 операций), каталог функций, дизайн-система, контракт (17 модулей + события),
  модель данных, ADR 0001–0018, спецификации, агенты, истории.
- ✅ 2026-10-22: план перестроен под backend-first: два потока, карточки модулей, заглушки общих сервисов,
  многофайловая схема Prisma, контрольные точки, у каждой задачи один владелец.
- ✅ 2026-10-22: PR #4 влит в `main` — Phase −1 полностью завершена.
- 🟦 T0.1: корневые инструменты (Prettier, `concurrently`) — [PR #5](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/5) на ревью. Кода приложений ещё нет.

## 3. Доска задач

Статусы: ⬜ не начата · 🟨 в работе · 🟦 на ревью (PR открыт) · ✅ влита в `main` · ⛔ заблокирована.
Задачи, зависимости и «готово, когда» — [IMPLEMENTATION_PLAN.md §5](IMPLEMENTATION_PLAN.md#5-задачи). Ревьюер — второй студент.

| ID | Задача (кратко) | Владелец | Обяз. | Статус | Ветка / PR | Блокер |
|---|---|---|---|---|---|---|
| T0.1 | Корневые инструменты | A | ✔ | 🟦 | `chore/root-tooling` → [PR #5](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/5) | ревью B |
| T0.2 | Каркас NestJS, Prisma 7, common | A | ✔ | 🟦 | в `main` через [PR #9](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/9) | — |
| T0.3 | Общие контракты и заглушки (C0) | A | ✔ | 🟦 | в `main` через [PR #9](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/9) | — |
| T0.4 | Каркас Next.js + токены | B | ✔ | ✅ | влита в `main` ([PR #8](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/8)) | — |
| T0.5 | Цепочка контракта, проверка прокси | B | ✔ | 🟦 | `chore/contract-pipeline` (PR — будет) | — |
| T0.6 | CI, защита `main`, harness | A | ✔ | 🟨 | `feat/a-integrations` (CI готов; защита `main` — вручную) | — |
| T0.7 | Оболочка `(main)` | B | ✔ | ✅ | влита в `main` ([PR #8](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/8)) | — |
| T1.A1 | `auth` | A | ✔ | 🟨 | `feat/backend-a` (коммит, ревью пройдено) | C0 в `main` |
| T1.A2 | Frontend входа | A | ✔ | ⬜ | — | T1.A1, T0.4 |
| T1.A3 | `users` + `settings` | A | ✔ | 🟨 | в `main` (PR #9) + аватар в `feat/a-integrations` | — |
| T1.A4 | `follows` | A | ✔ | 🟨 | `feat/backend-a` (коммит, ревью пройдено) | — |
| T1.A5 | `privacy`, `VisibilityService` | A | ✔ | 🟨 | `feat/backend-a` (коммит, ревью пройдено) | — |
| T1.A6 | `search` + история | A | ✔ | 🟨 | в `main` (PR #9) + хэштеги и места в `feat/a-integrations` | — |
| T1.B1 | `media` + `storage` | B | ✔ | 🟦 | `feat/backend-b` → [PR #9](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/9) | — |
| T1.B2 | `tags` | B | ✔ | 🟦 | `feat/backend-b` → [PR #9](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/9) | — |
| T1.B3 | `locations` | B | ✔ | 🟦 | `feat/backend-b` → [PR #9](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/9) | — |
| T1.B4 | `posts` | B | ✔ | 🟦 | `feat/backend-b` → [PR #9](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/9) | — |
| T1.B5 | `comments` | B | ✔ | 🟦 | `feat/backend-b` → [PR #9](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/9) | — |
| T2.A1 | `realtime` | A | ✔ | 🟨 | `feat/backend-a` (API готов; `lib/realtime.ts` — после T0.4) | T0.4 |
| T2.A2 | `notifications` | A | ✔ | 🟨 | в `main` (PR #9) + превью и FK в `feat/a-integrations` | — |
| T2.A3 | `collections` (сохранение) | A | ✔ | 🟨 | `feat/a-integrations` | — |
| T2.A4 | `chats` | A | ✔ | 🟨 | в `main` (PR #9) + медиа, голосовые, «поделиться» в `feat/a-integrations` | — |
| T2.B1 | `stories` + актуальное | B | ✔ | 🟦 | `feat/backend-b` → [PR #9](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/9) | — |
| T2.B2 | Ответы на истории → Direct | B | ✔ | 🟦 | `feat/backend-b` → [PR #9](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/9) | — |
| T3.A1 | UI профиля и настроек | A | ✔ | ⬜ | — | MA-1 |
| T3.A2 | UI подписок, блокировки, поиска | A | ✔ | ⬜ | — | MA-1 |
| T3.A3 | UI уведомлений | A | ✔ | ⬜ | — | T2.A2 |
| T3.A4 | UI «Сохранённое» | A | ✔ | ⬜ | — | T2.A3, T3.B1 |
| T3.A5 | UI Direct | A | ✔ | ⬜ | — | MA-2 |
| T3.B1 | UI ленты, карточки, окна поста | B | ✔ | 🟦 | `feat/web-b` (PR — будет) | — |
| T3.B2 | UI создания публикации | B | ✔ | 🟦 | `feat/web-b` (PR — будет) | — |
| T3.B3 | UI «Интересного», хэштега, места | B | ✔ | 🟦 | `feat/web-b` (PR — будет) | — |
| T3.B4 | UI Reels | B | ✔ | 🟦 | `feat/web-b` (PR — будет) | — |
| T3.B5 | UI комментариев | B | ✔ | 🟦 | `feat/web-b` (PR — будет) | — |
| T3.B6 | UI историй | B | ✔ | 🟦 | `feat/web-b` (PR — будет) | — |
| T4.A1 | Соцвход | A | — | 🟨 | `feat/backend-a` (backend; ключи — Q32) | Q32 |
| T4.A2 | Звонки 1:1 | A | — | 🟨 | `feat/backend-a` (backend и сигнализация; UI — T3.A5) | T3.A5 |
| T4.A3 | Ограничение, скрытие, близкие друзья | A | — | 🟨 | `feat/backend-a` (backend) | — |
| T4.A4 | Удаление аккаунта, сессии в UI, 2FA | A | — | 🟨 | `feat/backend-a` (backend) | UI — T3.A1 |
| T4.A5 | Подборки | A | — | 🟨 | `feat/a-integrations` (backend) | UI — T3.A4 |
| T4.A6 | Direct P1/P2 в UI | A | — | ⬜ | — | T3.A5 |
| T4.B1 | Правка, архив, закрепление публикаций | B | — | ⬜ | — | T3.B1 |
| T4.B2 | Комментарии P1 | B | — | 🟦 | `feat/backend-b` → [PR #9](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/9) | — |
| T4.B3 | Редактор историй, стикеры P2 | B | — | 🟦 | `feat/backend-b` → [PR #9](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/9) | — |
| T4.B4 | Жалобы и админ-панель | B | — | 🟦 | `feat/backend-b` → [PR #9](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/9) | — |
| T4.B5 | Обрезка и фильтры | B | — | ⬜ | — | T3.B2 |
| T5.A1 | Почта, TURN, деплой | A | — | ⬜ | — | Q23, Q24, Q34 |
| T5.A2 | Дизайн-сверка экранов A | A | ✔ | ⬜ | — | M-FE |
| T5.A3 | Подготовка к защите (A) | A | ✔ | ⬜ | — | M-FE |
| T5.B1 | Playwright | B | ✔ | ⬜ | — | M-FE |
| T5.B2 | Драйвер `s3` | B | — | ⬜ | — | Q25 |
| T5.B3 | Дизайн-сверка экранов B | B | ✔ | ⬜ | — | M-FE |
| T5.B4 | Подготовка к защите (B) | B | ✔ | ⬜ | — | M-FE |

## 4. Нужно от команды сейчас

| Что | Зачем |
|---|---|
| Ревью [PR #5](https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz/pull/5) (T0.1) Студентом B и слияние Студентом A | после влития B начинает T0.4 |
| Установить **ffmpeg** обоим | T1.B1 (видео, голосовые) |
| **Q1** — сроки и требования преподавателя | что из «опционально» войдёт в демонстрацию |
| **Q31** — название и логотип | T1.A2, T0.7 |

Полный список вопросов — [REQUIREMENTS.md §5](REQUIREMENTS.md#5-открытые-вопросы).

## 5. Закрытые вопросы и принятые изменения

| Дата | Что | Где отражено |
|---|---|---|
| 2026-10-20 | Новый REST API `/api/v1` с полным покрытием исходного Swagger | ADR 0002 |
| 2026-10-21 | pnpm → npm workspaces | ADR 0008 |
| 2026-10-21 | Субагенты: Opus — план/контракт/ревью, Sonnet — код/тесты, Haiku — проверки/STATUS | ADR 0009 |
| 2026-10-21 | Шаги фиксируются коммитами в текущей ветке; новая ветка не создаётся на каждое изменение | AGENTS.md §5 |
| 2026-10-21 | Запросы frontend — RTK Query (TanStack Query и openapi-fetch не используются) | ADR 0010 |
| 2026-10-21 | Каждое значимое действие фиксируется историей `docs/stories/ГГГГ-ММ-ДД_ЧЧММ_<slug>.md` | [stories/README.md](stories/README.md) |
| 2026-10-21 | Объём — паритет с веб-Instagram; из исключений возвращены звонки, голосовые, ответы на комментарии, хэштеги, упоминания, редактирование, вход через Google и Facebook | ADR 0011, [FEATURE_CATALOG.md](product/FEATURE_CATALOG.md) |
| 2026-10-21 | Дизайн по измерениям Instagram, свой бренд | ADR 0012 |
| 2026-10-21 | Socket.IO, OAuth, WebRTC, sharp/ffmpeg, курсорная пагинация | ADR 0013–0017 |
| 2026-10-21 | Q2–Q22, Q27–Q29 закрыты правилом «как в Instagram» | REQUIREMENTS §5 |
| 2026-10-22 | Документация одобрена; Q26: A — JM-2007-07, B — nek-yt | [IMPLEMENTATION_PLAN.md §2](IMPLEMENTATION_PLAN.md#2-потоки-работ), `.github/CODEOWNERS` |
| 2026-10-22 | Студент A (`JM-2007-07`) — владелец основной части и фундамента backend (подтверждено пользователем) | IMPLEMENTATION_PLAN §2 |
| 2026-10-22 | План перестроен под backend-first: два потока, `comments` → B, `collections` → A, frontend каждый делает для своих модулей, многофайловая схема Prisma и заглушки общих сервисов | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), ADR 0018 |

## 6. Известные проблемы и риски

| Проблема / риск | Что делать |
|---|---|
| Объём вырос в несколько раз; двум студентам может не хватить времени до защиты | строго соблюдать порядок P0 → P1 → P2; Q1 (сроки) определяет, что войдёт в демонстрацию |
| Прокси через Next.js rewrites не проверен на `Set-Cookie`, `Origin`, больших `multipart` | T0.5, запасной вариант в ADR 0004 |
| WebSocket не идёт через rewrites — нужен отдельный адрес сокета | ADR 0013, проверка в T2.A1 |
| `npm install prisma` ставит 8.0.0-rc (метка `latest`) | ✅ T0.2: `prisma`, `@prisma/client`, `@prisma/adapter-pg` — точно 7.10.1 |
| Обратные связи моделей B должны объявляться в модели `User` (файл A) | процедура в CONTRIBUTING «Общие файлы» |
| npm не запрещает импорт чужих зависимостей | правила ESLint в T0.2 и T0.4 (ADR 0008) |
| `npm audit`: 2 moderate в `js-yaml` внутри `@nestjs/swagger` 11 | исправление только через `@nestjs/swagger@12` (major) — вернуться при переходе на Nest 12 |
| Весь backend A в одной ветке `feat/backend-a` | B ждёт C0 в `main`: после T0.3 открыть PR (ветка поверх `chore/root-tooling`) |
| ffmpeg не установлен | установить до T1.B1 (LOCAL_SETUP) |
| Звонки через строгие NAT без TURN не соединятся | локально работают; продакшен — Q34 |
| Соцвход требует приложений разработчика | Q32; без ключей кнопки скрыты |
| Значения с 📝 в каталоге и дизайне не подтверждены | уточнять на дизайн-сверке в каждой UI-задаче (SCREENS §0) |
| Instagram меняет интерфейс | повторная сверка перед защитой (T5.A2, T5.B3) |

## 7. Истории

Оглавление журнала действий. Подробности каждого шага — в файле истории в [docs/stories/](stories/README.md).
Новая строка добавляется **сверху** вместе с новой историей. Записи не переписываются.

| Дата и время | История | Кратко |
|---|---|---|
| 2026-10-23 14:00 | [web-b-content](stories/2026-10-23_1400_web-b-content.md) | frontend B: лента, окно поста, создание, «Интересное», Reels, комментарии, истории (T3.B1–T3.B6); бренд из env и `public/brand/` |
| 2026-10-22 22:42 | [a-integrations](stories/2026-10-22_2242_a-integrations.md) | стыки A с модулями B (аватар, медиа в Direct, превью уведомлений, поиск хэштегов и мест), «Сохранённое», CI; 566 e2e |
| 2026-10-22 19:45 | [backend-b](stories/2026-10-22_1945_backend-b.md) | быстрый режим: backend B — media, tags, locations, posts, comments, stories, admin (e2e B 152); T0.5 в отдельной ветке |
| 2026-10-22 16:44 | [backend-a-batch1](stories/2026-10-22_1644_backend-a-batch1.md) | быстрый режим: Direct, уведомления, соцвход, звонки, ограничения, 2FA, удаление аккаунта (backend A); 390 e2e |
| 2026-10-22 16:11 | [web-shell](stories/2026-10-22_1611_web-shell.md) | T0.7: оболочка `(main)` — прокси по cookie, layout с проверкой сессии, боковое меню и «Ещё», тема в cookie; ветка от T0.4 |
| 2026-10-22 16:00 | [realtime](stories/2026-10-22_1600_realtime.md) | T2.A1: Socket.IO в API, комнаты пользователей, закрытие сокетов при выходе и смене пароля |
| 2026-10-22 15:52 | [search](stories/2026-10-22_1552_search.md) | T1.A6: поиск аккаунтов, подсказки `@`, история поиска; исправления по ревью T1.A4+T1.A5 |
| 2026-10-22 15:40 | [web-foundation](stories/2026-10-22_1540_web-foundation.md) | T0.4: каркас `apps/web` — Next.js 16, токены, RTK Query baseApi, Vitest; ветка от T0.1 |
| 2026-10-22 15:37 | [privacy](stories/2026-10-22_1537_privacy.md) | T1.A5: блокировки, настоящий `VisibilityService` для всех выдач A, `visibleAuthorWhere` для B |
| 2026-10-22 15:27 | [follows](stories/2026-10-22_1527_follows.md) | T1.A4: подписки и запросы, списки с курсором, рекомендации, общие подписчики |
| 2026-10-22 15:13 | [users-settings](stories/2026-10-22_1513_users-settings.md) | T1.A3: `/me`, профиль, имя, email, ссылки, настройки; ревью T1.A1+T1.A3, разделение сервисов auth |
| 2026-10-22 14:33 | [auth](stories/2026-10-22_1433_auth.md) | T1.A1: регистрация с кодом, вход, выход, сброс и смена пароля, сессии, лимиты; PR #6 для C0 |
| 2026-10-22 14:14 | [api-core-contracts](stories/2026-10-22_1414_api-core-contracts.md) | T0.3 (C0): User/Session/UserSettings, сессии, SessionGuard, заглушки общих сервисов, тестовые помощники, seed |
| 2026-10-22 12:15 | [api-foundation](stories/2026-10-22_1215_api-foundation.md) | T0.2: каркас NestJS 11 + Prisma 7, формат ошибок, Origin-guard, курсоры, Swagger, ESLint, Jest; весь backend A — в `feat/backend-a` |
| 2026-10-22 10:39 | [root-tooling](stories/2026-10-22_1039_root-tooling.md) | T0.1: Prettier и `concurrently` в корне; PR #4 влит, Phase −1 завершена |
| 2026-10-22 10:40 | [pr-and-onboarding](stories/2026-10-22_1040_pr-and-onboarding.md) | PR #4 с планом; онбординг для Студента B; роль студента по `git config user.name` |
| 2026-10-22 09:53 | [backend-first-plan](stories/2026-10-22_0953_backend-first-plan.md) | план перестроен: два независимых backend-потока, точки MA-1/MB-1, заглушки, многофайловая схема Prisma (ADR 0018) |
| 2026-10-22 09:16 | [assign-tasks](stories/2026-10-22_0916_assign-tasks.md) | задачи распределены: A — люди и общение, B — контент и интерфейс; CODEOWNERS |
| 2026-10-21 22:55 | [instagram-parity-audit](stories/2026-10-21_2255_instagram-parity-audit.md) | аудит Instagram в браузере; каталог функций, дизайн-система, новый контракт и модель, ADR 0011–0017, план из 45 задач |
| 2026-10-21 19:14 | [switch-to-rtk-query](stories/2026-10-21_1914_switch-to-rtk-query.md) | запросы frontend — RTK Query (ADR 0010 вместо 0005): baseApi, теги, infiniteQuery, клиентская загрузка данных |
| 2026-10-21 18:53 | [add-stories](stories/2026-10-21_1853_add-stories.md) | введены истории; три истории задним числом; создание истории — часть Definition of Done |
| 2026-10-21 10:42 | [add-subagents](stories/2026-10-21_1042_add-subagents.md) | 8 субагентов (Opus/Sonnet/Haiku), AI_AGENTS.md, ADR 0009 |
| 2026-10-21 10:38 | [npm-and-harness-docs](stories/2026-10-21_1038_npm-and-harness-docs.md) | pnpm → npm (ADR 0008); AGENTS.md, карта docs, STATUS, глоссарий, playbooks; ID задач |
| 2026-10-20 22:20 | [initial-documentation](stories/2026-10-20_2220_initial-documentation.md) | анализ Swagger, вся начальная документация, структура; PR #1 |
