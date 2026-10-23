import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makePost } from '@/features/posts/test-fixtures';
import { mockFetch, renderWithStore } from '@/lib/test-utils';
import { HomeFeed } from './home-feed';

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('HomeFeed', () => {
  it('skeleton при загрузке', () => {
    mockFetch([{ path: '/feed', body: { items: [], nextCursor: null } }]);
    renderWithStore(<HomeFeed />);
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('пустая лента — «Добро пожаловать»', async () => {
    mockFetch([
      { path: '/feed', body: { items: [], nextCursor: null } },
      { path: '/users/suggestions', body: [] },
    ]);
    renderWithStore(<HomeFeed />);
    expect(await screen.findByText('Добро пожаловать')).toBeInTheDocument();
  });

  it('список постов и «Вы всё посмотрели» в конце', async () => {
    mockFetch([
      { path: '/feed', body: { items: [makePost()], nextCursor: null } },
      { path: '/users/suggestions', body: [] },
    ]);
    renderWithStore(<HomeFeed />);
    expect(await screen.findByText('Вы всё посмотрели')).toBeInTheDocument();
    expect(screen.getByText('5 отметок "Нравится"')).toBeInTheDocument();
  });

  it('ошибка — кнопка «Повторить»', async () => {
    mockFetch([
      {
        path: '/feed',
        status: 500,
        body: { statusCode: 500, code: 'INTERNAL_ERROR', message: 'x' },
      },
    ]);
    renderWithStore(<HomeFeed />);
    expect(await screen.findByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});
