import { screen } from '@testing-library/react';
import { baseApi } from '@/lib/api/base-api';
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
    expect(screen.getByTestId('like-count')).toHaveTextContent('5');
  });

  it('после инвалидации Feed в ленте нет дублей', async () => {
    // Метка видна сразу — вторая страница подгружается автоматически.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(private cb: (e: { isIntersecting: boolean }[]) => void) {}
        observe() {
          this.cb([{ isIntersecting: true }]);
        }
        disconnect() {}
      },
    );
    const fetchMock = mockFetch([{ path: '/users/suggestions', body: [] }]);
    const base = fetchMock.getMockImplementation()!;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
          'http://localhost',
        );
        if (url.pathname.endsWith('/feed')) {
          const second = url.searchParams.get('cursor') === 'c1';
          const body = second
            ? {
                items: [makePost({ id: 'p2', shortcode: 's2', caption: 'Вторая' })],
                nextCursor: null,
              }
            : {
                items: [makePost({ id: 'p1', shortcode: 's1', caption: 'Первая' })],
                nextCursor: 'c1',
              };
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return base(input, init);
      }),
    );
    const { store } = renderWithStore(<HomeFeed />);
    expect(await screen.findByText('Вторая')).toBeInTheDocument();
    expect(screen.getAllByText('Первая')).toHaveLength(1);

    store.dispatch(baseApi.util.invalidateTags(['Feed']));
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getAllByText('Первая')).toHaveLength(1);
    expect(screen.getAllByText('Вторая')).toHaveLength(1);
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
