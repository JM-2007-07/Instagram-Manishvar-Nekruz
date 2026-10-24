import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessagesDock } from './messages-dock';

const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
vi.mock('@/features/notifications/components/nav-badge', () => ({ NavBadge: () => null }));
vi.mock('../api', () => ({ useGetChatsInfiniteQuery: () => ({ data: undefined }) }));

function shown(path: string) {
  nav.pathname = path;
  const { unmount } = render(<MessagesDock meId="me" />);
  const visible = !!screen.queryByRole('link', { name: 'Сообщения' });
  unmount();
  return visible;
}

describe('MessagesDock', () => {
  it('видна в ленте, профиле и «Интересном»', () => {
    expect(shown('/')).toBe(true);
    expect(shown('/alice/')).toBe(true);
    expect(shown('/explore/')).toBe(true);
    expect(shown('/accounts-fan/')).toBe(true); // профиль с похожим именем — не настройки
  });

  it('скрыта в Direct, настройках, на странице публикации и в историях', () => {
    expect(shown('/direct/inbox/')).toBe(false);
    expect(shown('/accounts/edit/')).toBe(false);
    expect(shown('/p/abc123/')).toBe(false);
    expect(shown('/stories/bob/1/')).toBe(false);
  });
});
