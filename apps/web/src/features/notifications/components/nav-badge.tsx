'use client';

import { useGetBadgesQuery } from '../api';

// Красная точка («Уведомления») или счётчик «9+» («Сообщения») поверх иконки пункта меню.
export function NavBadge({ kind }: { kind: 'notifications' | 'messages' }) {
  const { data } = useGetBadgesQuery();
  if (!data) return null;

  if (kind === 'notifications') {
    if (data.unreadNotifications === 0) return null;
    return (
      <span
        role="status"
        aria-label="Есть новые уведомления"
        className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-badge ring-2 ring-background"
      />
    );
  }

  if (data.unreadChats === 0) return null;
  return (
    <span
      role="status"
      aria-label={`Непрочитанных чатов: ${data.unreadChats}`}
      className="absolute -top-2 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-badge px-1 text-11 font-semibold text-white ring-2 ring-background"
    >
      {data.unreadChats > 9 ? '9+' : data.unreadChats}
    </span>
  );
}
