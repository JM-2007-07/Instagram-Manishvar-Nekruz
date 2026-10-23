'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { BrandGlyph } from '@/components/layout/brand-logo';
import { MoreMenu } from '@/components/layout/more-menu';
import {
  SIDEBAR_ITEMS,
  activeIconClass,
  isActivePath,
  type NavItem,
} from '@/components/layout/nav-items';
import { NavBadge } from '@/features/notifications/components/nav-badge';
import { NotificationsPanel } from '@/features/notifications/components/notifications-panel';
import type { Me } from '@/lib/api/types';
import { DESIGN } from '@/lib/design';
import type { Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

// Пункт как у Instagram (2026): 48 px + зазор 8, иконка 24 px, подпись 16/20 с x = 64 px;
// фон при наведении — --hover-overlay (5 % чёрного), скругление 8.
const itemClass =
  'group flex h-12 w-full items-center gap-4 rounded-lg px-3 text-16 outline-none transition-colors duration-100 ease-[var(--ease-hover)] hover:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-ring';

// Подпись видна только в раскрытом меню. Меню остаётся раскрытым, пока открыто «Ещё»
// (radix уводит фокус и наведение в выпадающий список, и без has-[…] меню бы свернулось).
// Фокус раскрывает меню только с клавиатуры (:focus-visible): после клика мышью ссылка остаётся в фокусе,
// и с focus-within меню не сворачивалось бы после перехода на другую страницу.
const labelClass =
  'whitespace-nowrap opacity-0 transition-opacity duration-150 ease-(--ease-hover) group-hover/sidebar:opacity-100 group-has-[:focus-visible]/sidebar:opacity-100 group-has-[[data-state=open]]/sidebar:opacity-100';

function SidebarItem({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  const content = (
    <>
      <span className="relative shrink-0">
        <Icon className={cn('size-6', activeIconClass(item.key, active))} />
        {item.key === 'notifications' && <NavBadge kind="notifications" />}
        {item.key === 'messages' && <NavBadge kind="messages" />}
      </span>
      <span className={cn(labelClass, active && 'font-bold')}>{item.label}</span>
    </>
  );
  // В свёрнутом виде подписи не видно, поэтому aria-label обязателен.
  if (!item.href) {
    return (
      <button
        type="button"
        aria-label={item.label}
        aria-disabled={onClick ? undefined : 'true'}
        onClick={onClick}
        className={itemClass}
      >
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const profileHref = `/${me.userName}/`;
  const profileActive = isActivePath(pathname, profileHref, true);

  // Перешли на другую страницу — закрываем панели и снимаем фокус с пункта, чтобы меню свернулось.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setNotificationsOpen(false);
  }
  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('[data-sidebar]')) active.blur();
  }, [pathname]);

  return (
    <aside className="hidden shrink-0 md:block" style={{ width: DESIGN.sidebarCollapsed }}>
      <nav
        aria-label="Основная навигация"
        data-sidebar
        className="group/sidebar fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden bg-background px-3 pt-6 pb-5 w-[72px] transition-[width] duration-150 ease-(--ease-move) hover:w-[238px] has-[:focus-visible]:w-[238px] has-[[data-state=open]]:w-[238px] motion-reduce:transition-none"
      >
        {/* У Instagram знак 24 px остаётся и в раскрытом меню, без рамки справа */}
        <Link href="/" aria-label="Главная" className="flex h-14 shrink-0 items-center px-3">
          <BrandGlyph className="text-foreground" />
        </Link>

        <ul className="my-auto flex flex-col gap-2">
          {SIDEBAR_ITEMS.map((item) => (
            <li key={item.key}>
              <SidebarItem
                item={item}
                active={
                  item.key === 'notifications'
                    ? notificationsOpen
                    : !!item.href && isActivePath(pathname, item.href, item.key === 'search')
                }
                onClick={
                  item.key === 'notifications' ? () => setNotificationsOpen(true) : undefined
                }
              />
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

        <div>
          <MoreMenu userName={me.userName} theme={theme} triggerClassName={itemClass} />
        </div>
      </nav>
      <NotificationsPanel open={notificationsOpen} onOpenChange={setNotificationsOpen} />
    </aside>
  );
}
