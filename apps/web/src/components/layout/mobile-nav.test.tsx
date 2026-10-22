import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Me } from '@/lib/api/types';
import { MobileBottomBar } from './mobile-nav';

vi.mock('next/navigation', () => ({ usePathname: () => '/explore/' }));

const me = { userName: 'alice', avatarUrl: null } as unknown as Me;

describe('MobileBottomBar', () => {
  it('содержит пять вкладок и отмечает активную', () => {
    render(<MobileBottomBar me={me} />);
    const nav = within(screen.getByRole('navigation', { name: 'Основная навигация' }));
    const names = [...screen.getByRole('navigation').querySelectorAll('a,button')].map((el) =>
      el.getAttribute('aria-label'),
    );
    expect(names).toEqual(['Главная', 'Интересное', 'Reels', 'Создать', 'Профиль']);
    expect(nav.getByRole('link', { name: 'Интересное' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'Профиль' })).toHaveAttribute('href', '/alice');
  });
});
