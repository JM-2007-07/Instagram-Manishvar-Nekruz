# 2026-10-24 16:40 — Render: запуск сайта, почта не уходит → коды в логах

| | |
|---|---|
| Задача | T5.A1 (деплой) |
| Фаза | Phase 5, выпуск |
| Автор | Claude Code (Opus) по запросу Студента A |
| Агенты | — |
| Ветка, коммиты | `fix/auth-404` · коммит с этой историей → PR в `main` |

## Запрос
Проверить сайт на Render по чек-листу DEPLOYMENT.md и починить найденное перед показом.

## Что сделано
- **API не запускался:** `MAIL_DRIVER=log` запрещён в production. Открыт и влит PR #17 (ветка B `fix/render-smtp`).
- **Страницы отвечали 404:** у сервисов не были заданы адресные переменные (`WEB_ORIGIN`, `WEB_UPSTREAM_URL`,
  `API_INTERNAL_URL`, `NEXT_PUBLIC_REALTIME_URL`, `PUBLIC_ORIGIN`) — пользователь ввёл их в панели Render.
- **Регистрация падала:** Gmail SMTP — `Connection timeout`: бесплатный Render блокирует порты 25/465/587.
  Brevo на порту 2525 доставил одно письмо, затем отключил отправку («Your sending platform is currently disabled»).
- **Запасной вариант:** флаг `MAIL_LOG_IN_PRODUCTION=true` разрешает `MAIL_DRIVER=log` в production
  (`apps/api/src/config/env.ts`); `render.yaml` задаёт оба значения, коды регистрации видны в Logs `instagram-api`.
- DEPLOYMENT.md: про закрытые SMTP-порты, Brevo на 2525, 502 от спящего `instagram-web`.

## Проверка
- `jest src/config src/mail` → 17 из 17 (новый тест флага); `tsc` api → без ошибок; Prettier → ок
- Сайт https://instagram-api-adj7.onrender.com: health 200, гость → `/accounts/login`, Socket.IO отвечает
- Не проверено: вход/выход, Direct без перезагрузки, загрузка фото; работа флага на Render — после деплоя

## Изменённые файлы
- `apps/api/src/config/{env.ts,env.spec.ts}`, `apps/api/.env.example`, `render.yaml`
- `docs/development/DEPLOYMENT.md`, `docs/STATUS.md`

## Проблемы и отклонения
- Сброс пароля по письму на Render не работает, пока почта в режиме log.
- Пока спит `instagram-web`, публичный адрес отвечает 502 — прокси API его не будит.

## Открытые вопросы
- —

## Что дальше
- Пройти оставшиеся пункты чек-листа, залить демо-данные перед показом.
