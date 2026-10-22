'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export const SETTINGS_SECTIONS = [
  { href: '/accounts/edit/', label: 'Редактировать профиль' },
  { href: '/accounts/settings/privacy/', label: 'Конфиденциальность' },
  { href: '/accounts/close_friends/', label: 'Близкие друзья' },
  { href: '/accounts/blocked_accounts/', label: 'Заблокированные аккаунты' },
  { href: '/accounts/restricted/', label: 'Ограниченные аккаунты' },
  { href: '/accounts/muted/', label: 'Скрытые аккаунты' },
  { href: '/accounts/hide_story_and_live/', label: 'Скрыть истории и эфиры' },
  { href: '/accounts/favorites/', label: 'Избранное' },
  { href: '/accounts/follow_requests/', label: 'Запросы на подписку' },
  { href: '/accounts/settings/notifications/', label: 'Уведомления' },
  { href: '/accounts/settings/appearance/', label: 'Тема и язык' },
  { href: '/accounts/password/change/', label: 'Пароль' },
  { href: '/accounts/settings/sessions/', label: 'Сессии' },
  { href: '/accounts/settings/two-factor/', label: 'Двухфакторная защита' },
  { href: '/accounts/settings/account/', label: 'Деактивация и удаление' },
];

// Раскладка настроек как у Instagram: слева список разделов, справа содержимое.
export function SettingsNav() {
  const pathname = usePathname();
  const current = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return (
    <nav
      aria-label="Разделы настроек"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-separator p-2 md:w-[280px] md:flex-col md:border-r md:border-b-0 md:p-4"
    >
      <h2 className="hidden px-3 py-2 text-20 font-semibold md:block">Настройки</h2>
      {SETTINGS_SECTIONS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? 'page' : undefined}
          className={cn(
            'rounded-lg px-3 py-3 text-14 whitespace-nowrap hover:bg-hover-overlay',
            current === href && 'bg-background-secondary font-semibold',
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
