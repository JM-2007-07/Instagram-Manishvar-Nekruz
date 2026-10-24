# 2026-10-24 13:00 — деплой API на Render падал: MAIL_DRIVER=log запрещён в production

| | |
|---|---|
| Задача | — (деплой, ADR 0020) |
| Фаза | Phase 5 |
| Автор | Claude Code (оркестратор, Opus 5.5) по запросу Студента B (`nek-yt`) |
| Агенты | — |
| Ветка, коммиты | `fix/render-smtp` · коммит с этой историей |

## Запрос
Деплой `349434f` (PR #16) на Render: «Exited with status 1», `npm run start -w api` → `node dist/main.js` падает. Найти и исправить.

## Что сделано
- Воспроизведено локально (`npm run build -w api`, `NODE_ENV=production node dist/main.js`):
  `Invalid environment configuration: MAIL_DRIVER: "log" is not allowed in production`.
- `render.yaml`: `MAIL_DRIVER=smtp`, `SMTP_HOST/PORT/USER/PASSWORD` и `MAIL_FROM` — `sync: false` (задаются в панели Render).
- `docs/development/DEPLOYMENT.md`: убрано обещание, что `log` работает на Render; таблица переменных исправлена.

## Решения и почему
- Правило в `apps/api/src/config/env.ts` не ослаблялось: оно намеренное и покрыто тестом (коды входа не должны жить только в логах).

## Изменённые файлы
- `render.yaml`, `docs/development/DEPLOYMENT.md` — общие файлы A (деплой), нужно ревью A.

## Проверка
- `NODE_ENV=production MAIL_DRIVER=smtp SMTP_*=… node dist/main.js` → конфигурация принята, модули инициализированы (дальше — подключение к БД).
- ⚠️ не проверено: деплой на Render (нужны реальные SMTP_* в панели).

## Проблемы и отклонения
- Пока `SMTP_*` не заданы в Environment сервиса `instagram-api`, API снова не стартует (`SMTP_HOST, SMTP_PORT: required`).

## Открытые вопросы
- —

## Что дальше
- Задать SMTP_* (Gmail + пароль приложения) в Render, слить PR, Manual Deploy.
