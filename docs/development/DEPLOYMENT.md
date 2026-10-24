# Развёртывание на Render

Выбор: [Render](https://render.com), бесплатный план; схема — [ADR 0020](../decisions/0020-render-single-origin.md).
Описание сервисов — `render.yaml` в корне репозитория. Значения секретов в репозиторий и документы не кладём.

## Что получится

| Сервис Render | Что это | Публичный? |
|---|---|---|
| `instagram-db` | PostgreSQL (free, удаляется через 30 дней) | нет |
| `instagram-api` | NestJS: `/api/v1`, `/socket.io`, **и пересылка страниц** в `instagram-web` | **да — это адрес сайта** |
| `instagram-web` | Next.js (страницы) | только для `instagram-api` |

## Шаги

1. Влить ветку с `render.yaml` в `main` и запушить (Render берёт код из GitHub).
2. Render → **New → Blueprint** → репозиторий `JM-2007-07/Instagram-Manishvar-Nekruz`, ветка `main` → **Apply**.
   Render создаст базу и два сервиса и спросит значения `sync: false` — пока можно оставить пустыми.
3. Когда сервисы созданы, у каждого есть адрес `https://…onrender.com`. Заполнить **Environment**:

   | Сервис | Переменная | Значение |
   |---|---|---|
   | `instagram-api` | `WEB_ORIGIN` | адрес `instagram-api` (без `/` в конце) |
   | `instagram-api` | `WEB_UPSTREAM_URL` | адрес `instagram-web` |
   | `instagram-web` | `API_INTERNAL_URL` | адрес `instagram-api` |
   | `instagram-web` | `NEXT_PUBLIC_REALTIME_URL` | адрес `instagram-api` |
   | `instagram-web` | `PUBLIC_ORIGIN` | адрес `instagram-api` |

4. **Manual Deploy → Deploy latest commit** у обоих сервисов (`NEXT_PUBLIC_*` встраиваются при сборке — после
   изменения адреса `instagram-web` нужно пересобрать).
5. Демо-аккаунты и данные — со своего компьютера (на бесплатном плане нет консоли на сервере):
   - пользователи: в Render → `instagram-db` → **Connect → External Database URL**, затем локально
     `DATABASE_URL=<этот адрес> npm run prisma:seed -w api` (адрес не сохранять в файлах);
   - публикации, чаты, reels: `API_URL=<адрес instagram-api> WEB_ORIGIN=<адрес instagram-api> npm run demo-data -w api`.
6. Открыть **адрес `instagram-api`** — это и есть сайт.

## Проверить после деплоя

1. `<адрес>/api/v1/health` → 200.
2. Гость на `<адрес>/` попадает на `<адрес>/accounts/login/` (не на адрес `instagram-web`).
3. Вход и выход; после перезагрузки вход сохраняется.
4. Direct: сообщение со второго аккаунта приходит без перезагрузки.
5. Загрузка фото доходит до показа; видео и голосовые — до статуса `READY` (ffmpeg есть в среде Render).

## Ограничения бесплатного плана (важно для экзамена)

- Сервисы засыпают через 15 минут без запросов, первое открытие — около минуты. **Открыть сайт за 5 минут до показа.**
- **Файлы на диске временные:** фото, видео и голосовые пропадают после сна, перезапуска и нового деплоя.
  Запускать `demo-data` незадолго до показа и не давать сервису уснуть. Постоянно — только платный план с диском
  или драйвер `s3` (T5.B2).
- Письма с кодами не отправляются (`MAIL_DRIVER=log`): код регистрации виден в **Logs** сервиса `instagram-api`.
  Для писем — `MAIL_DRIVER=smtp` и `SMTP_*` в Environment.
- Звонки между разными сетями могут не соединиться без TURN (`TURN_URLS`, `TURN_SHARED_SECRET`).

## Локальная проверка схемы

`.claude/launch.json` (локальный файл): `render-sim-api` (порт 4200, пересылает страницы) и `render-sim-web`
(порт 3200). Перед этим: `npm run build -w api` и в `apps/web` —
`API_INTERNAL_URL=http://localhost:4200 NEXT_PUBLIC_REALTIME_URL=http://localhost:4200 npx next build`.

## Не делать

- `prisma migrate reset` и `migrate dev` на рабочей базе — только `migrate deploy` (он в команде запуска API).
- Не коммитить значения переменных и адрес базы.
