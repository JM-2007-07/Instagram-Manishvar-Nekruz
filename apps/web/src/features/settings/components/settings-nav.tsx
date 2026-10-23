'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Ban,
  Bell,
  BellOff,
  CircleUserRound,
  EyeOff,
  Heart,
  KeyRound,
  Lock,
  MessageCircleOff,
  MonitorSmartphone,
  ShieldCheck,
  Star,
  SunMoon,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Разделы, сгруппированные как в настройках Instagram (2026).
export const SETTINGS_GROUPS = [
  {
    title: 'Как вы используете приложение',
    items: [
      { href: '/accounts/edit/', label: 'Редактировать профиль', icon: CircleUserRound },
      { href: '/accounts/settings/notifications/', label: 'Уведомления', icon: Bell },
      { href: '/accounts/settings/appearance/', label: 'Тема и язык', icon: SunMoon },
    ],
  },
  {
    title: 'Кто может видеть ваш контент',
    items: [
      { href: '/accounts/settings/privacy/', label: 'Конфиденциальность', icon: Lock },
      { href: '/accounts/close_friends/', label: 'Близкие друзья', icon: Star },
      { href: '/accounts/blocked_accounts/', label: 'Заблокированные аккаунты', icon: Ban },
      { href: '/accounts/hide_story_and_live/', label: 'Скрыть истории и эфиры', icon: EyeOff },
    ],
  },
  {
    title: 'Взаимодействие с вами',
    items: [
      { href: '/accounts/restricted/', label: 'Ограниченные аккаунты', icon: MessageCircleOff },
      { href: '/accounts/muted/', label: 'Скрытые аккаунты', icon: BellOff },
      { href: '/accounts/favorites/', label: 'Избранное', icon: Heart },
      { href: '/accounts/follow_requests/', label: 'Запросы на подписку', icon: UserPlus },
    ],
  },
  {
    title: 'Ваш аккаунт',
    items: [
      { href: '/accounts/password/change/', label: 'Пароль', icon: KeyRound },
      { href: '/accounts/settings/sessions/', label: 'Сессии', icon: MonitorSmartphone },
      { href: '/accounts/settings/two-factor/', label: 'Двухфакторная защита', icon: ShieldCheck },
      { href: '/accounts/settings/account/', label: 'Деактивация и удаление', icon: Trash2 },
    ],
  },
];

export const SETTINGS_SECTIONS = SETTINGS_GROUPS.flatMap((group) => group.items);

// Меню настроек как у Instagram: колонка 400 px, заголовок 20/25, группы 12/16 серым,
// пункты 48 px со значком 24 px; на телефоне — полоса разделов с прокруткой.
export function SettingsNav() {
  const pathname = usePathname();
  const current = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return (
    <nav
      aria-label="Разделы настроек"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-separator p-2 md:w-[400px] md:flex-col md:gap-0 md:overflow-x-visible md:border-b-0 md:px-[34px] md:pt-10 md:pb-6"
    >
      <h2 className="hidden px-4 pb-6 text-20 leading-[25px] font-bold md:block">Настройки</h2>
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.title} className="contents md:block md:pb-4">
          <h3 className="hidden px-4 pt-4 pb-3 text-12 font-semibold text-muted-foreground md:block">
            {group.title}
          </h3>
          {group.items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={current === href ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-14 whitespace-nowrap hover:bg-hover-overlay md:h-12 md:px-4 md:py-0',
                current === href && 'bg-background-secondary max-md:font-semibold',
              )}
            >
              <Icon className="hidden size-6 shrink-0 md:block" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
