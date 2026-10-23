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
// пункты 48 px со значком 24 px. На телефоне то же меню — отдельная страница /accounts/settings/.
export function SettingsNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const current = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return (
    <nav
      aria-label="Разделы настроек"
      className={cn(
        'flex shrink-0 flex-col px-3 pt-2 pb-6 md:w-[400px] md:px-[34px] md:pt-10',
        className,
      )}
    >
      <h2 className="px-4 pb-2 text-20 leading-[25px] font-bold md:pb-6">Настройки</h2>
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.title} className="pb-4">
          <h3 className="px-4 pt-4 pb-3 text-12 font-semibold text-muted-foreground">
            {group.title}
          </h3>
          {group.items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={current === href ? 'page' : undefined}
              className={cn(
                'flex h-12 items-center gap-3 rounded-lg px-4 text-14 hover:bg-hover-overlay',
                current === href && 'md:bg-background-secondary',
              )}
            >
              <Icon className="size-6 shrink-0" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
