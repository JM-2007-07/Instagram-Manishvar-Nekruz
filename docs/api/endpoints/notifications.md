# Эндпоинты: `notifications`

> Модуль `notifications` · функции F-NTF-* · спецификация [features/notifications.md](../../features/notifications.md).

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F |
|---|---|---|---|---|---|
| `GET /notifications` | User | `?cursor` | `Page<Notification>` — сгруппированные, новые сначала | — | F-NTF-01…03 |
| `POST /notifications/read` | User | `{ upToId? }` — по умолчанию все | `204` | — | F-NTF-04 |
| `GET /me/badges` | User | — | `{ unreadNotifications, unreadChats, followRequests }` | — | F-NTF-04, F-DM-01 |

Правила:
- Уведомления создаются модулями-источниками после успешной операции (`NotificationsService.create`) с учётом
  `NotificationPreference`, блокировок, ограничений и скрытия. Самому себе уведомления не создаются.
- Группировка при выдаче: одинаковые `type` + объект (`postId`/`commentId`) за 24 часа 📝 → `actors` (до 3) и `actorCount`.
- Отмена действия (снятый лайк, отписка) удаляет непрочитанное уведомление.
- Новое уведомление → событие `notification:new` и обновлённые значки `badges:updated` ([REALTIME.md](../REALTIME.md)).
- Web Push (F-NTF-07, P2) — отдельное решение.
