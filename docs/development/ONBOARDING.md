# Подключение к проекту (для каждого студента)

> Статус: ✅ 2026-10-22. Пошаговая настройка компьютера, репозитория и Claude Code. Написано для Студента B (`nek-yt`);
> Студент A (`JM-2007-07`) проходит те же шаги со своим логином.

## 1. Установить программы

| Программа | Зачем | Как проверить |
|---|---|---|
| Node.js 24 (npm 11 входит) | оба приложения | `node -v` → `v24.x` |
| Git | репозиторий | `git --version` |
| PostgreSQL 16+ | база данных | `psql --version` |
| ffmpeg | видео и голосовые (нужен с T1.B1) | `ffmpeg -version` (Windows: `winget install Gyan.FFmpeg`) |
| Claude Code (приложение Claude или CLI) | работа с агентами проекта | открыть Claude → вкладка Code |

Docker и облачные аккаунты не нужны. Подробности по БД и env — [LOCAL_SETUP.md](LOCAL_SETUP.md).

## 2. Настроить Git — обязательно своим логином

```bash
git config --global user.name "nek-yt"
git config --global user.email "<email, привязанный к GitHub-аккаунту nek-yt>"
```

Claude определяет, кто с ним работает (Студент A или B), **по `git config user.name`** ([AGENTS.md §4](../../AGENTS.md#4-рабочий-цикл-агента)).
С чужим логином он будет считать вас другим студентом. Проверка: `git config user.name` → `nek-yt`.

## 3. Получить репозиторий

```bash
git clone https://github.com/JM-2007-07/Instagram-Manishvar-Nekruz.git
cd Instagram-Manishvar-Nekruz
git switch main
git pull
```

- Если репозиторий уже клонирован (например, ветка `nek`): `git switch main && git pull`. Старую ветку `nek`
  больше не использовать — каждая задача делается в новой ветке от `main`.
- Убедитесь, что в `main` есть `docs/IMPLEMENTATION_PLAN.md` с разделом «Потоки работ» — значит, PR с планом влит.

## 4. Подключить Claude Code

1. Открыть Claude → **Code** → выбрать папку `Instagram-Manishvar-Nekruz` (корень репозитория, не `apps/web`).
2. Ничего настраивать не нужно: при запуске Claude сам читает `CLAUDE.md` и `AGENTS.md` из репозитория, а агенты
   проекта (`planner`, `backend-dev`, `frontend-dev`, `test-writer`, `verifier`, `reviewer`, `docs-keeper`,
   `contract-designer`) берутся из `.claude/agents/` ([AI_AGENTS.md](AI_AGENTS.md)).
3. Первое сообщение в новой сессии (можно скопировать):

   > Я Студент B (nek-yt). Прочитай docs/STATUS.md и docs/IMPLEMENTATION_PLAN.md и скажи, какая моя следующая задача,
   > готова ли она к началу (зависимости) и какие файлы я буду менять. Ничего не меняй, пока я не подтвержу план.

4. Чтобы начать задачу: «Сделай T0.4. Создай ветку feat/web-foundation от свежего main». Claude построит план
   (`planner`), покажет его, затем выполнит по конвейеру агентов, закоммитит в ветку и создаст историю в `docs/stories/`.
5. Push и PR Claude делает **только по вашей просьбе**: «Отправь ветку и открой PR в main».

Личные настройки Claude (`.claude/settings.local.json`) в репозиторий не попадают — они в `.gitignore`.

## 5. Как работать каждый день

```bash
git switch main && git pull                 # свежий main
git switch -c feat/<модуль>-<кратко>        # новая ветка на задачу (или git switch <ветка>, если продолжаете)
git fetch && git rebase origin/main         # подтянуть чужие изменения (ежедневно)
```

- Задачи Студента B — строки с буквой **B** на доске [STATUS.md](../STATUS.md) (`T0.4`, `T0.5`, `T0.7`, `T1.B1`…).
- Менять только файлы своих модулей; общие файлы — по таблице [CONTRIBUTING.md «Общие файлы»](../../CONTRIBUTING.md#общие-файлы).
- Модули Студента A (`auth`, `users`, `settings`, `follows`, `privacy`, `search`, `collections`, `realtime`,
  `notifications`, `chats`, `calls`, фундамент backend) не трогать — вызывать только через их сервисы.
- PR: шаблон заполнить, указать выполненную проверку, ревьюер — Студент A. Слияние — после одобрения и зелёного CI.

## 6. Порядок задач Студента B

| Шаг | Задача | Ветка | Можно начать, когда |
|---|---|---|---|
| 1 | Ревью PR #4 с планом (оставить «Approve» или замечания) | — | сейчас |
| 2 | **T0.4** каркас Next.js + дизайн-токены | `feat/web-foundation` | T0.1 (A) влита в `main` |
| 3 | **T0.5** цепочка контракта, проверка прокси | `chore/contract-pipeline` | T0.2 (A) и T0.4 влиты |
| 4 | **T0.7** оболочка приложения | `feat/web-shell` | T0.4 влита |
| 5 | **T1.B1** медиа (часть без HTTP — после T0.2; эндпоинты — после C0) | `feat/media-upload` | T0.2 / C0; установлен ffmpeg |
| 6 | T1.B2 хэштеги, T1.B3 места, T1.B4 публикации, T1.B5 комментарии | по задаче | по [плану §5](../IMPLEMENTATION_PLAN.md#5-задачи) |

Пока ждёте влития задачи Студента A — берите следующую свою задачу без этой зависимости или делайте ревью его PR.

## 7. Если что-то не так

| Проблема | Что делать |
|---|---|
| Claude называет вас Студентом A | `git config user.name` должен быть `nek-yt`; перезапустить сессию |
| `git push` отклонён | нет прав на репозиторий — Студент A добавляет `nek-yt` в Settings → Collaborators |
| Нужно изменить общий файл или чужой модуль | сначала написать Студенту A; см. [CHANGE_PROCESS.md](CHANGE_PROCESS.md) |
| Конфликт в `package-lock.json` | взять версию `main` и выполнить `npm install` |
| Код подтверждения не приходит на почту | по умолчанию `MAIL_DRIVER=log`: письмо с кодом печатается в журнал API (окно, где запущен `npm run dev`, строка `Mail to …`). Чтобы письма приходили по-настоящему, в `apps/api/.env`: `MAIL_DRIVER=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER` и `MAIL_FROM` — ваш Gmail, `SMTP_PASSWORD` — пароль приложения Google (Аккаунт → Безопасность → Двухэтапная аутентификация → Пароли приложений); перезапустить API |
| Документы противоречат друг другу | не угадывать — спросить Claude «найди противоречие» и обсудить со Студентом A |
