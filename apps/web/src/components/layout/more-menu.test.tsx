import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { MoreMenu } from './more-menu';

const setTheme = vi.fn();
const replace = vi.fn();
const logout = vi.fn(() => ({ unwrap: () => Promise.resolve() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/features/auth/api', () => ({
  useLogoutMutation: () => [logout, { isLoading: false }],
}));
vi.mock('@/lib/theme', async (orig) => ({
  ...(await orig<typeof import('@/lib/theme')>()),
  setTheme: (t: string) => setTheme(t),
}));

// Минимальные заглушки браузерных API, которых нет в jsdom (нужны Radix).
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});

function openMenu() {
  render(<MoreMenu userName="alice" theme="system" />);
  const trigger = screen.getByRole('button', { name: 'Ещё' });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
}

describe('MoreMenu', () => {
  it('открывается и показывает пункты', () => {
    openMenu();
    const href = (name: string) =>
      screen.getByRole('menuitem', { name }).getAttribute('href')?.replace(/\/$/, '');
    expect(href('Настройки')).toBe('/accounts/edit');
    expect(href('Сохранённое')).toBe('/alice/saved');
    expect(screen.getByRole('menuitem', { name: 'Переключить режим' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Выйти' })).toBeInTheDocument();
  });

  it('Esc закрывает меню', () => {
    openMenu();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('выбор «Тёмная» вызывает setTheme("dark")', () => {
    openMenu();
    const sub = screen.getByRole('menuitem', { name: 'Переключить режим' });
    fireEvent.keyDown(sub, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Тёмная' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('«Выйти» вызывает logout и ведёт на страницу входа', async () => {
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Выйти' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/accounts/login/'));
    expect(logout).toHaveBeenCalled();
  });
});
