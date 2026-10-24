import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '@/lib/api/types';
import { Sidebar } from './sidebar';

let pathname = '/';
vi.mock('@/features/search/user-search', () => ({ useClearAccountSearch: () => () => {} }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/components/layout/more-menu', () => ({
  MoreMenu: () => <button type="button" aria-label="Ещё" />,
}));

vi.mock('@/features/notifications/components/nav-badge', () => ({ NavBadge: () => null }));
vi.mock('@/features/notifications/components/notifications-panel', () => ({
  NotificationsPanel: () => null,
}));

const me = { userName: 'alice', avatarUrl: null } as unknown as Me;

function renderSidebar() {
  render(<Sidebar me={me} theme="system" />);
  return within(screen.getByRole('navigation', { name: 'Основная навигация' }));
}

describe('Sidebar', () => {
  beforeEach(() => {
    pathname = '/';
  });

  it('пункты идут в порядке DESIGN_SYSTEM §4.1 и имеют доступные имена', () => {
    const nav = renderSidebar();
    const names = nav
      .getAllByRole('listitem')
      .map((li) => li.querySelector('a,button')!.getAttribute('aria-label'));
    expect(names).toEqual([
      'Главная',
      'Reels',
      'Сообщения',
      'Поиск',
      'Уведомления',
      'Создать',
      'Профиль',
    ]);
    expect(nav.getByRole('button', { name: 'Ещё' })).toBeInTheDocument();
  });

  it('ссылки ведут на нужные адреса', () => {
    const nav = renderSidebar();
    // Next Link убирает завершающий слэш (trailingSlash: false), поэтому сравниваем без него.
    const href = (name: string) =>
      nav.getByRole('link', { name }).getAttribute('href')?.replace(/\/$/, '');
    // «Поиск» ведёт на «Интересное» (поле поиска там, как у instagram.com).
    expect(href('Поиск')).toBe('/explore');
    expect(href('Профиль')).toBe('/alice');
    expect(href('Reels')).toBe('/reels');
  });

  it('aria-current="page" только у активного пункта', () => {
    pathname = '/reels/';
    const nav = renderSidebar();
    expect(nav.getByRole('link', { name: 'Reels' })).toHaveAttribute('aria-current', 'page');
    for (const link of nav.getAllByRole('link')) {
      if (link.getAttribute('aria-label') !== 'Reels') {
        expect(link).not.toHaveAttribute('aria-current');
      }
    }
  });

  it('профиль активен на страницах пользователя', () => {
    pathname = '/alice/saved/';
    const nav = renderSidebar();
    expect(nav.getByRole('link', { name: 'Профиль' })).toHaveAttribute('aria-current', 'page');
  });
});
