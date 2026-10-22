# Локальная настройка

> ⚠️ **Шаги 3–7 пока не работают**: приложения создаются в Phase 0. Документ описывает целевой процесс
> и обновляется по мере реализации (статус — в [STATUS.md](../STATUS.md)).

## Требования

| Инструмент | Версия | Проверка |
|---|---|---|
| Node.js | 24.x | `node -v` |
| npm | 11.x (входит в Node.js 24) | `npm -v` |
| PostgreSQL | 16+ (у текущего разработчика — 18) | `psql --version` |
| ffmpeg | любая актуальная (с ffprobe) — для видео и голосовых | `ffmpeg -version` |
| Git | любая актуальная | `git --version` |

Docker, облачные аккаунты и ключи **не нужны**. Ключи Google/Facebook (соцвход) и TURN (звонки вне локальной сети)
необязательны: без них соответствующие функции скрыты или работают только локально.

## Шаги

1. **Node.js 24** — установить с nodejs.org (npm ставится вместе с ним); **ffmpeg** — с ffmpeg.org или `winget install Gyan.FFmpeg`, проверить `ffmpeg -version`.
2. **Клонирование:** `git clone https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz.git`.
3. **Зависимости:** `npm install` в корне (ставит зависимости обоих приложений; lockfile один — корневой).
4. **База данных:** создать две локальные БД:
   ```sql
   CREATE DATABASE instagram;
   CREATE DATABASE instagram_test;
   ```
5. **Переменные окружения:**
   - `apps/api/.env.example` → `apps/api/.env`; указать свой `DATABASE_URL`;
   - `apps/web/.env.example` → `apps/web/.env.local`.
6. **Миграции и демо-данные:** `npm run prisma:migrate -w api` и `npm run prisma:seed -w api`.
7. **Запуск:** `npm run dev` → web на http://localhost:3000, API на http://localhost:4000,
   Swagger UI на http://localhost:4000/api/docs 📝.

## Частые проблемы (заполняется по ходу)

| Симптом | Причина / решение |
|---|---|
| в `apps/web` или `apps/api` появился свой `package-lock.json` | зависимость ставили изнутри приложения; ставить из корня: `npm install <pkg> -w web`, лишний lockfile удалить |
| ошибка подключения к БД | служба PostgreSQL не запущена или неверный пароль в `DATABASE_URL` |
| cookie не сохраняется после входа | открываете API напрямую (порт 4000) вместо сайта (порт 3000) |
