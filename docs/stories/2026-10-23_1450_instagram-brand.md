# 2026-10-23 14:50 — название и логотип Instagram по умолчанию для всего проекта

| | |
|---|---|
| Задача | Q31 (название и логотип), изменение ADR 0012 |
| Фаза | Phase 1–2 |
| Автор | Claude Code (оркестратор, Opus 5.5) по запросу Студента A |
| Агенты | — |
| Ветка, коммиты | `feat/web-a` · коммит с этой историей |

## Запрос
Студент A попросил вместо нашего знака поставить логотип Instagram по ссылке и сделать это «глобально» — в репозитории,
а не только локально («это учебный проект»).

## Что сделано
- Логотип скачан в `apps/web/public/brand/mark.png` (600×600, со страницы foni.papik.pro по ссылке пользователя),
  в `BrandLogo` у знака скругление 22 % (как у иконки приложения).
- `public/brand/` больше не в `.gitignore`: в репозитории `mark.png` и `default-avatar.jpg` (картинка «нет фото»
  по ссылке пользователя с pinimg.com).
- По умолчанию: `APP_NAME` / `NEXT_PUBLIC_APP_NAME` = «Instagram» (web, API — темы писем, `.env.example`),
  `BRAND_MARK_SRC` = `/brand/mark.png`, `DEFAULT_AVATAR_SRC` = `/brand/default-avatar.jpg`.
- ADR 0012 — раздел «Изменение 2026-10-23»; Q31 закрыт; DESIGN_SYSTEM §1 обновлён.

## Решения и почему
- Решение принял Студент A после предупреждения о риске: публичный репозиторий со страницей входа с логотипом и
  названием Instagram может быть отмечен GitHub как фишинг. Откат описан в ADR 0012.
- Шрифт Instagram Sans и иконки Instagram по-прежнему не используются.

## Изменённые файлы
- `apps/web/public/brand/{mark.png,default-avatar.jpg}` (новые), `.gitignore`
- `apps/web/src/lib/config.ts`, `components/layout/brand-logo.tsx` (файл B), `apps/web/.env.example`
- `apps/api/src/config/env.ts`, `apps/api/.env.example`
- `docs/decisions/0012-design-system-instagram.md`, `docs/REQUIREMENTS.md` (Q31), `docs/design/DESIGN_SYSTEM.md`

## Проверка
- lint, typecheck web и api → без ошибок; `npm run test -w web` → 114; `npm run test -w api` → 69
- в браузере: знак в боковом меню и на заставке, скругление 22 %
- ⚠️ не проверено: страница входа после выхода (знак 60 px) — в этой сессии не выходили из аккаунта

## Проблемы и отклонения
- Изменено решение ADR 0012, принятое вместе со Студентом B, — нужно сообщить ему.
- Заголовок Swagger остался «Photogram API» (чтобы не перегенерировать контракт ради названия).

## Открытые вопросы
- —

## Что дальше
- Сообщить Студенту B об изменении ADR 0012 и Q31.
