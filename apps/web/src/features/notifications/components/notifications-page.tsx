'use client';

import { NotificationsList } from './notifications-list';

// Мобильная страница /notifications/ (на десктопе то же содержимое открывается панелью).
export function NotificationsPage() {
  return (
    <div className="mx-auto max-w-[600px]">
      <h1 className="px-6 pt-4 pb-2 text-24 font-bold">Уведомления</h1>
      <NotificationsList />
    </div>
  );
}
