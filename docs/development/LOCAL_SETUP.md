# Локальная настройка

> ⚠️ **Шаги 3–7 пока не работают**: приложения создаются в Phase 0. Документ описывает целевой процесс
> и обновляется по мере реализации.

## Требования

| Инструмент | Версия | Проверка |
|---|---|---|
| Node.js | 24.x | `node -v` |
| pnpm | 12.8.2 (через corepack) | `pnpm -v` |
| PostgreSQL | 16+ (у текущего разработчика — 18) | `psql --version` |
| Git | любая актуальная | `git --version` |

Docker, облачные аккаунты и ключи **не нужны**.

## Шаги

1. **pnpm:** `corepack enable` (один раз; при ошибке прав — терминал от администратора).
2. **Клонирование:** `git clone https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz.git`.
3. **Зависимости:** `pnpm install` в корне.
4. **База данных:** создать две локальные БД:
   ```sql
   CREATE DATABASE instagram;
   CREATE DATABASE instagram_test;
   ```
5. **Переменные окружения:**
   - `apps/api/.env.example` → `apps/api/.env`; указать свой `DATABASE_URL`;
   - `apps/web/.env.example` → `apps/web/.env.local`.
6. **Миграции и демо-данные:** `pnpm --filter api prisma:migrate` и `pnpm --filter api prisma:seed`.
7. **Запуск:** `pnpm dev` → web на http://localhost:3000, API на http://localhost:4000,
   Swagger UI на http://localhost:4000/api/docs 📝.

## Частые проблемы (заполняется по ходу)

| Симптом | Причина / решение |
|---|---|
| `pnpm: command not found` | не выполнен `corepack enable` |
| ошибка подключения к БД | служба PostgreSQL не запущена или неверный пароль в `DATABASE_URL` |
| cookie не сохраняется после входа | открываете API напрямую (порт 4000) вместо сайта (порт 3000) |
