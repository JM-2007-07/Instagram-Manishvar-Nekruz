import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { mockFetch, renderWithStore } from '@/lib/test-utils';
import type { Post } from '@/features/posts/types';
import { PostGrid } from './components/post-grid';
import { SearchBox } from './components/search-box';
import { HashtagPage } from './components/hashtag-page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));

afterEach(() => vi.unstubAllGlobals());

const user = {
  id: 'u1',
  userName: 'anna',
  fullName: 'Анна',
  avatarUrl: null,
  isVerified: false,
  isPrivate: false,
  hasActiveStory: false,
  isCloseFriendStory: false,
};
const media = (kind: 'IMAGE' | 'VIDEO') => ({
  id: 'm',
  kind,
  status: 'READY' as const,
  url: '/m.jpg',
  thumbnailUrl: '/t.jpg',
  width: 1,
  height: 1,
  durationSec: null,
});
const post = (id: string, over: Partial<Post> = {}) =>
  ({
    id,
    shortcode: `sc${id}`,
    type: 'POST',
    author: user,
    likeCount: 5,
    commentCount: 2,
    items: [{ position: 0, media: media('IMAGE'), altText: null, tags: [] }],
    ...over,
  }) as unknown as Post;

const grid = (posts: Post[] | undefined, extra = {}) => (
  <PostGrid
    posts={posts}
    isLoading={false}
    isError={false}
    hasNextPage={false}
    isFetching={false}
    onLoadMore={() => {}}
    onRetry={() => {}}
    {...extra}
  />
);

describe('PostGrid', () => {
  it('плитки — ссылки на /p/…/ со значками типов', () => {
    const reel = post('2', {
      type: 'REEL',
      items: [{ position: 0, media: media('VIDEO'), altText: null, tags: [] }],
    });
    const carousel = post('3', { items: [post('x').items[0], post('y').items[0]] });
    renderWithStore(grid([post('1'), reel, carousel]));
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href')?.replace(/\/$/, ''))).toEqual([
      '/p/sc1',
      '/p/sc2',
      '/p/sc3',
    ]);
    expect(screen.getAllByTestId('tile-badge')).toHaveLength(2);
    expect(screen.getByLabelText('Видео')).toBeInTheDocument();
    expect(screen.getByLabelText('Карусель')).toBeInTheDocument();
  });

  it('пустой список — текст', () => {
    renderWithStore(grid([], { emptyText: 'Пусто' }));
    expect(screen.getByText('Пусто')).toBeInTheDocument();
  });

  it('ошибка — «Повторить»', () => {
    const onRetry = vi.fn();
    renderWithStore(grid(undefined, { isError: true, onRetry }));
    fireEvent.click(screen.getByText('Повторить'));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('SearchBox', () => {
  it('недавнее и «Очистить все»', async () => {
    const fetchMock = mockFetch([
      {
        path: '/me/search-history',
        body: {
          nextCursor: null,
          items: [
            { id: 'h1', type: 'HASHTAG', hashtag: { name: 'cats', postCount: 3 }, createdAt: '' },
          ],
        },
      },
      { method: 'DELETE', path: '/me/search-history', status: 204 },
    ]);
    renderWithStore(<SearchBox />);
    fireEvent.focus(screen.getByLabelText('Поиск'));
    expect(await screen.findByText('#cats')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Очистить все'));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([r]) => (r as Request).method === 'DELETE')).toBe(true),
    );
  });

  it('ввод: debounce 300 мс и результаты трёх типов', async () => {
    const fetchMock = mockFetch([
      { path: '/me/search-history', body: { items: [], nextCursor: null } },
      {
        path: '/search',
        body: {
          users: [user],
          hashtags: [{ name: 'anna_tag', postCount: 7 }],
          locations: [{ id: 'l1', name: 'Парк', slug: 'park', city: 'Москва', country: 'RU' }],
        },
      },
    ]);
    renderWithStore(<SearchBox />);
    const input = screen.getByLabelText('Поиск');
    fireEvent.change(input, { target: { value: 'an' } });
    fireEvent.change(input, { target: { value: 'ann' } });
    const searchCalls = () =>
      fetchMock.mock.calls.filter(([r]) => String((r as Request).url).includes('/search?')).length;
    expect(searchCalls()).toBe(0);
    expect(await screen.findByText('#anna_tag')).toBeInTheDocument();
    expect(searchCalls()).toBe(1);
    expect(screen.getByText('anna').closest('a')).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/anna\/?$/),
    );
    expect(screen.getByText('Парк').closest('a')).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/explore\/locations\/l1\/park\/?$/),
    );
  });
});

describe('HashtagPage', () => {
  it('показывает заголовок, число публикаций и сетку', async () => {
    mockFetch([
      { path: '/hashtags/cats', body: { name: 'cats', postCount: 12 } },
      { path: '/hashtags/cats/posts', body: { items: [post('1')], nextCursor: null } },
    ]);
    renderWithStore(<HashtagPage tag="cats" />);
    expect(await screen.findByText('#cats')).toBeInTheDocument();
    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Публикация anna/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/p\/sc1\/?$/),
    );
  });

  it('404 — страница недоступна', async () => {
    mockFetch([]);
    renderWithStore(<HashtagPage tag="nope" />);
    expect(await screen.findByText('К сожалению, эта страница недоступна.')).toBeInTheDocument();
  });
});
