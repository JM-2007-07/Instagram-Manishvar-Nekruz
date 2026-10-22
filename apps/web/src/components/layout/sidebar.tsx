'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';
import { BrandLogo } from '@/components/layout/brand-logo';
import { MoreMenu } from '@/components/layout/more-menu';
import { SIDEBAR_ITEMS, type NavItem } from '@/components/layout/nav-items';
import type { Me } from '@/lib/api/types';
import { DESIGN } from '@/lib/design';
import type { Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

// Пункт: иконка 24 px, подпись с x = 64 px; фон при наведении — --hover-overlay.
const itemClass =
  'group flex h-14 w-full items-center gap-4 rounded-lg px-3 text-14 transition-colors duration-100 ease-[var(--ease-hover)] hover:bg-hover-overlay';

// Подпись видна только в раскрытом меню.
const labelClass =
  'whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100';

function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const content = (
    <>
      <Icon className={cn('size-6 shrink-0', active && 'fill-current')} />
      <span className={cn(labelClass, active && 'font-bold')}>{item.label}</span>
    </>
  );
  // В свёрнутом виде подписи не видно, поэтому aria-label обязателен.
  if (!item.href) {
    return (
      <button type="button" aria-label={item.label} className={itemClass}>
        {content}
      </button>
    );
  }
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className={itemClass}
    >
      {content}
    </Link>
  );
}

// Боковое меню ≥ 768 px: место в потоке всегда 72 px, при наведении/фокусе внутренний
// fixed-блок раскрывается поверх контента до 238 px (DESIGN_SYSTEM §4.1).
export function Sidebar({ me, theme }: { me: Me; theme: Theme }) {
  const pathname = usePathname();
  const profileHref = `/${me.userName}/`;
  const profileActive = pathname.startsWith(profileHref);

  return (
    <aside className="hidden shrink-0 md:block" style={{ width: DESIGN.sidebarCollapsed }}>
      <nav
        aria-label="Основная навигация"
        className="group/sidebar fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-border bg-background px-3 pt-6 pb-5 transition-[width] duration-100 ease-[var(--ease-hover)] focus-within:w-[238px] hover:w-[238px]"
        style={{ width: DESIGN.sidebarCollapsed }}
      >
        <Link href="/" aria-label="Главная" className="mb-6 flex h-14 items-center px-3">
          <span className="group-hover/sidebar:hidden group-focus-within/sidebar:hidden">
            <BrandLogo variant="mark" />
          </span>
          <span className="hidden group-hover/sidebar:block group-focus-within/sidebar:block">
            <BrandLogo />
          </span>
        </Link>

        <ul className="flex flex-col gap-1">
          {SIDEBAR_ITEMS.map((item) => (
            <li key={item.key}>
              {/* TODO(T3.A3, Студент A): счётчик на «Сообщения» и точка на «Уведомления» */}
              {/* «Поиск» ведёт на тот же /explore/, подсвечиваем только «Интересное» */}
              <SidebarItem item={item} active={item.href === pathname} />
            </li>
          ))}
          <li>
            <Link
              href={profileHref}
              aria-label="Профиль"
              aria-current={profileActive ? 'page' : undefined}
              className={itemClass}
            >
              {me.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={me.avatarUrl}
                  alt=""
                  className={cn(
                    'size-6 shrink-0 rounded-full object-cover',
                    profileActive && 'ring-2 ring-foreground',
                  )}
                />
              ) : (
                <User className={cn('size-6 shrink-0', profileActive && 'fill-current')} />
              )}
              <span className={cn(labelClass, profileActive && 'font-bold')}>Профиль</span>
            </Link>
          </li>
        </ul>

        <div className="mt-auto">
          <MoreMenu userName={me.userName} theme={theme} triggerClassName={itemClass} />
        </div>
      </nav>
    </aside>
  );
}
