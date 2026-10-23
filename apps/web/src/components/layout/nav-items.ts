import { Clapperboard, Compass, Heart, House, Search, Send, SquarePlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Пункты навигации (данные). Без href — кнопка без действия (панель пока не готова).
export type NavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
};

export const HOME: NavItem = { key: 'home', label: 'Главная', icon: House, href: '/' };
// «Поисковый запрос» в Instagram ведёт на /explore/ (SCREENS §1); панели поиска нет (задача A).
export const SEARCH: NavItem = {
  key: 'search',
  label: 'Поисковый запрос',
  icon: Search,
  href: '/explore/',
};
export const EXPLORE: NavItem = {
  key: 'explore',
  label: 'Интересное',
  icon: Compass,
  href: '/explore/',
};
export const REELS: NavItem = { key: 'reels', label: 'Reels', icon: Clapperboard, href: '/reels/' };
export const MESSAGES: NavItem = {
  key: 'messages',
  label: 'Сообщения',
  icon: Send,
  href: '/direct/inbox/',
};
// TODO(T3.A3, Студент A): панель уведомлений
export const NOTIFICATIONS: NavItem = { key: 'notifications', label: 'Уведомления', icon: Heart };
// TODO(T3.B2): окно создания публикации
export const CREATE: NavItem = {
  key: 'create',
  label: 'Создать',
  icon: SquarePlus,
  href: '/create/',
};

// Next.js открывает /explore/ как /explore (trailingSlash выключен), поэтому сравниваем пути без «/» в конце.
const trimSlash = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

// Пункт активен на своём адресе; nested — и на вложенных (/alice/saved для профиля /alice/).
export function isActivePath(pathname: string, href: string, nested = false) {
  const current = trimSlash(pathname);
  const target = trimSlash(href);
  return current === target || (nested && current.startsWith(`${target}/`));
}

// Боковое меню, порядок — DESIGN_SYSTEM §4.1 (профиль и «Ещё» добавляются в sidebar.tsx — им нужен me).
export const SIDEBAR_ITEMS: NavItem[] = [HOME, REELS, MESSAGES, SEARCH, NOTIFICATIONS, CREATE];

// Нижняя панель на мобильном (профиль добавляется в mobile-nav.tsx).
export const BOTTOM_ITEMS: NavItem[] = [HOME, EXPLORE, REELS, CREATE];
