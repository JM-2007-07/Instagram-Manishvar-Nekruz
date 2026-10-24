/* eslint-disable @next/next/no-html-link-for-pages -- обычные <a> проверяют перехват клика по ссылке */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModalSlot } from './modal-slot';

const nav = vi.hoisted(() => ({ pathname: '/', back: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ back: nav.back }),
}));

function shown(path: string) {
  nav.pathname = path;
  const { unmount } = render(<ModalSlot>окно</ModalSlot>);
  const visible = !!screen.queryByText('окно');
  unmount();
  return visible;
}

describe('ModalSlot', () => {
  it('показывает окно на адресах окон', () => {
    expect(shown('/p/abc123/')).toBe(true);
    expect(shown('/create')).toBe(true);
    expect(shown('/alice/followers/')).toBe(true);
    expect(shown('/alice/following')).toBe(true);
  });

  it('скрывает окно на обычных страницах', () => {
    expect(shown('/')).toBe(false);
    expect(shown('/alice/')).toBe(false);
    expect(shown('/explore/tags/sunset/')).toBe(false);
    expect(shown('/accounts/login/')).toBe(false);
  });

  it('ссылка на страницу под окном закрывает окно, другие ссылки работают как обычно', () => {
    nav.back.mockReset();
    nav.pathname = '/bob';
    const { rerender } = render(
      <ModalSlot>
        <a href="/bob/">bob</a>
        <a href="/explore/">explore</a>
      </ModalSlot>,
    );
    nav.pathname = '/p/abc';
    rerender(
      <ModalSlot>
        <a href="/bob/">bob</a>
        <a href="/explore/">explore</a>
      </ModalSlot>,
    );
    fireEvent.click(screen.getByText('bob'));
    expect(nav.back).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('explore'));
    expect(nav.back).toHaveBeenCalledTimes(1);
  });
});
