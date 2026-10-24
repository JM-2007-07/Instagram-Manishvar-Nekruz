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
- Почта — только `MAIL_DRIVER=smtp`: с `log` при `NODE_ENV=production` API не запускается
  (`MAIL_DRIVER: "log" is not allowed in production`, `apps/api/src/config/env.ts`). В Environment задать
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` (для Gmail — пароль приложения, как в `.env.example`).
- Звонки между разными сетями могут не соединиться без TURN (`TURN_URLS`, `TURN_SHARED_SECRET`).

## Локальная проверка схемы

`.claude/launch.json` (локальный файл): `render-sim-api` (порт 4200, пересылает страницы) и `render-sim-web`
(порт 3200). Перед этим: `npm run build -w api` и в `apps/web` —
`API_INTERNAL_URL=http://localhost:4200 NEXT_PUBLIC_REALTIME_URL=http://localhost:4200 npx next build`.

## Не делать

- `prisma migrate reset` и `migrate dev` на рабочей базе — только `migrate deploy` (он в команде запуска API).
- Не коммитить значения переменных и адрес базы.

---

# Вариант: Railway

Та же схема (ADR 0020): публичный адрес — сервис API, он пересылает страницы сервису сайта. Отличия от Render:
постоянный диск (Volume) — файлы не пропадают; сервисы не засыпают; ffmpeg ставится переменной;
пробный период $5 на 30 дней, дальше Hobby $5/мес. `render.yaml` не нужен — настройки задаются в панели Railway.

## Шаги

1. [railway.com](https://railway.com) → **Login → GitHub**, дать доступ к репозиторию.
2. **New Project → Deploy from GitHub repo** → `JM-2007-07/Instagram-Manishvar-Nekruz`. Появится один сервис —
   переименовать в `api`. В проекте **+ Create → Database → PostgreSQL**. Ещё раз **+ Create → GitHub Repo** →
   тот же репозиторий → переименовать в `web`.
3. У обоих сервисов: **Settings → Source → Branch** — ветка с этим кодом (`fix/auth-404` или `main`);
   **Settings → Networking → Generate Domain** — получить адрес `https://…up.railway.app`.
4. **Сервис `api`:**
   - Settings → Build → Custom Build Command: `npm ci --include=dev && npm run build -w api`
   - Settings → Deploy → Custom Start Command: `npm exec -w api -- prisma migrate deploy && npm run start -w api`
   - Settings → Deploy → Healthcheck Path: `/api/v1/health`
   - правая кнопка на сервисе → **Attach Volume**, Mount path `/data`
   - Variables:

     | Переменная | Значение |
     |---|---|
     | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (ссылка на базу, Railway подставит сам) |
     | `NODE_ENV` | `production` |
     | `WEB_ORIGIN` | адрес сервиса **api** |
     | `WEB_UPSTREAM_URL` | адрес сервиса **web** |
     | `TRUST_PROXY` | `true` |
     | `SESSION_COOKIE_NAME` | `__Host-sid` |
     | `SESSION_IDLE_TTL_DAYS` / `SESSION_ABSOLUTE_TTL_DAYS` | `7` / `30` |
     | `PASSWORD_RESET_TTL_MINUTES` | `30` |
     | `MAIL_DRIVER` | `smtp` + `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` (`log` в production запрещён) |
     | `APP_NAME` / `MAIL_FROM` | `Instagram` / адрес отправителя (для Gmail — тот же, что `SMTP_USER`) |
     | `STORAGE_DRIVER` / `STORAGE_LOCAL_DIR` | `local` / `/data/storage` |
     | `RAILPACK_DEPLOY_APT_PACKAGES` | `ffmpeg` |
     | `TWO_FACTOR_ENCRYPTION_KEY` | любая случайная строка от 32 символов (по желанию) |

5. **Сервис `web`:**
   - Custom Build Command: `npm ci --include=dev && npm run build -w web`
   - Custom Start Command: `npm exec -w web -- next start -p $PORT`
   - Variables: `NODE_ENV=production`, `NEXT_PUBLIC_APP_NAME=Instagram`, а `API_INTERNAL_URL`,
     `NEXT_PUBLIC_REALTIME_URL`, `PUBLIC_ORIGIN` — **все три = адрес сервиса api**.
6. **Deploy** у обоих (после изменения адресов `web` пересобрать — `NEXT_PUBLIC_*` встраиваются при сборке).
7. Данные — со своего компьютера, как в разделе Render: адрес базы — в сервисе Postgres → **Connect → Public
   Network** (`DATABASE_PUBLIC_URL`), `prisma:seed`; затем `demo-data` с `API_URL` и `WEB_ORIGIN` = адрес api.
8. Сайт — **адрес сервиса api**. Проверки — те же, что выше.
