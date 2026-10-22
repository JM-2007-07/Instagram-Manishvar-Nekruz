'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Send, User } from 'lucide-react';
import { BrandLogo } from '@/components/layout/brand-logo';
import { BOTTOM_ITEMS, MESSAGES, NOTIFICATIONS, isActivePath } from '@/components/layout/nav-items';
import { NavBadge } from '@/features/notifications/components/nav-badge';
import type { Me } from '@/lib/api/types';
import { DESIGN } from '@/lib/design';
import { cn } from '@/lib/utils';

// Мобильная оболочка < 768 px: верхняя панель (логотип, уведомления, сообщения) и нижняя панель вкладок.
const iconButton = 'flex size-10 items-center justify-center rounded-lg hover:bg-hover-overlay';

export function MobileTopBar() {
  return (
    <header
      className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-border bg-background px-4 md:hidden"
      style={{ height: DESIGN.mobileTopBarHeight }}
    >
      <Link href="/" aria-label="Главная">
        <BrandLogo />
      </Link>
      <div className="flex items-center gap-2">
        <Link href="/notifications/" aria-label={NOTIFICATIONS.label} className={iconButton}>
          <span className="relative">
            <Heart className="size-6" />
            <NavBadge kind="notifications" />
          </span>
        </Link>
        <Link href={MESSAGES.href ?? '/'} aria-label={MESSAGES.label} className={iconButton}>
          <span className="relative">
            <Send className="size-6" />
            <NavBadge kind="messages" />
          </span>
        </Link>
      </div>
    </header>
  );
}

export function MobileBottomBar({ me }: { me: Me }) {
  const pathname = usePathname();
  const profileHref = `/${me.userName}/`;
  const profileActive = isActivePath(pathname, profileHref, true);
  const tab = 'flex flex-1 items-center justify-center';

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background md:hidden"
      style={{ height: DESIGN.mobileBottomBarHeight }}
    >
      {BOTTOM_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = !!item.href && isActivePath(pathname, item.href);
        const icon = <Icon className={cn('size-6', active && 'fill-current')} />;
        return item.href ? (
          <Link
            key={item.key}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            className={tab}
          >
            {icon}
          </Link>
        ) : (
          // TODO(T3.B2): окно создания публикации
          <button
            key={item.key}
            type="button"
            aria-label={item.label}
            aria-disabled="true"
            className={tab}
          >
            {icon}
          </button>
        );
      })}
      <Link
        href={profileHref}
        aria-label="Профиль"
        aria-current={profileActive ? 'page' : undefined}
        className={tab}
      >
        {me.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={me.avatarUrl}
            alt=""
            className={cn(
              'size-6 rounded-full object-cover',
              profileActive && 'ring-2 ring-foreground',
            )}
          />
        ) : (
          <User className={cn('size-6', profileActive && 'fill-current')} />
        )}
      </Link>
    </nav>
  );
}
