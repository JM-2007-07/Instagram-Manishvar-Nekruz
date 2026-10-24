import { fireEvent, render as renderRtl, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeQueryClient } from '@/lib/query-client';
import { SearchContent, postsCount } from './search-content';

const removeEntry = vi.fn();
const clearHistory = vi.fn();
const addHistory = vi.fn();

type Q = Record<string, unknown>;
let history: Q;
let tags: Q;
let places: Q;

vi.mock('../api', () => ({
  useGetRecentSearchesInfiniteQuery: () => history,
  useFindHashtagsQuery: () => tags,
  useFindLocationsQuery: () => places,
  useAddRecentSearchMutation: () => [addHistory, {}],
  useRemoveRecentSearchMutation: () => [removeEntry, {}],
  useClearRecentSearchesMutation: () => [clearHistory, { isLoading: false }],
}));
// Без ожидания 300 мс: значение сразу равно введённому.
vi.mock('@/features/users/use-debounced-value', () => ({ useDebouncedValue: <T,>(v: T) => v }));

const user = {
  id: 'u1',
  userName: 'bob',
  fullName: 'Bob B',
  avatarUrl: null,
  isVerified: false,
  isPrivate: false,
  hasActiveStory: false,
  isCloseFriendStory: false,
};

function historyOf(items: unknown[]): Q {
  return {
    isLoading: false,
    isError: false,
    data: { pages: [{ items, nextCursor: null }] },
    hasNextPage: false,
    isFetchingNextPage: false,
  };
}

// Аккаунты ищет настоящий TanStack Query; подменяем только fetch.
const accountsFetch = vi.fn();
function mockAccounts(items: unknown[], status = 200) {
  accountsFetch.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(status === 200 ? { items, nextCursor: null } : { code: 'X' }), {
        status,
      }),
    ),
  );
  vi.stubGlobal('fetch', accountsFetch);
}

function render(ui: React.ReactElement) {
  return renderRtl(<QueryClientProvider client={makeQueryClient()}>{ui}</QueryClientProvider>);
}

const page = (items: unknown[]) => ({
  isLoading: false,
  isError: false,
  data: { items, nextCursor: null },
});

describe('SearchContent', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    removeEntry.mockReset();
    clearHistory.mockReset();
    addHistory.mockReset();
    history = historyOf([]);
    tags = page([]);
    places = page([]);
    accountsFetch.mockReset();
    mockAccounts([]);
  });

  it('пустая история → «Нет недавних запросов»', () => {
    render(<SearchContent />);
    expect(screen.getByText('Нет недавних запросов')).toBeInTheDocument();
  });

  it('показывает недавнее, удаляет запись и очищает всё', () => {
    history = historyOf([
      { id: 'e1', type: 'USER', user, createdAt: '2026-01-01T00:00:00Z' },
      { id: 'e2', type: 'QUERY', query: 'кошки', createdAt: '2026-01-01T00:00:00Z' },
    ]);
    render(<SearchContent />);
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('кошки')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Удалить из недавнего' })[0]);
    expect(removeEntry).toHaveBeenCalledWith('e1');

    fireEvent.click(screen.getByRole('button', { name: 'Очистить все' }));
    expect(clearHistory).toHaveBeenCalled();
  });

  it('ввод → результаты: аккаунт (TanStack Query), хэштег, место; клик пишет в историю', async () => {
    mockAccounts([user]);
    tags = page([{ name: 'cats', postCount: 5 }]);
    places = page([{ id: 'l1', name: 'Парк', slug: 'park', city: 'Минск', country: 'Беларусь' }]);
    render(<SearchContent />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ca' } });

    expect(await screen.findByText('bob')).toBeInTheDocument();
    expect(accountsFetch).toHaveBeenCalledTimes(1);
    expect(String(accountsFetch.mock.calls[0]![0])).toBe('/api/v1/search/users?q=ca&limit=20');
    expect(screen.getByText('#cats')).toBeInTheDocument();
    expect(screen.getByText('5 публикаций')).toBeInTheDocument();
    expect(screen.getByText('Парк')).toBeInTheDocument();

    fireEvent.click(screen.getByText('#cats'));
    expect(addHistory).toHaveBeenCalledWith({ type: 'HASHTAG', hashtagName: 'cats' });
  });

  it('нет результатов → «Ничего не найдено»', async () => {
    render(<SearchContent />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
  });

  it('ошибка поиска аккаунтов → сообщение с повтором', async () => {
    mockAccounts([], 500);
    render(<SearchContent />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bo' } });
    expect(
      await screen.findByRole('button', { name: /Повторить/ }, { timeout: 4000 }),
    ).toBeInTheDocument();
  });

  it('пустое поле с idle — показывает idle вместо «Недавнего»', () => {
    render(<SearchContent idle={<p>сетка</p>} />);
    expect(screen.getByText('сетка')).toBeInTheDocument();
    expect(screen.queryByText('Нет недавних запросов')).not.toBeInTheDocument();
    expect(accountsFetch).not.toHaveBeenCalled();
  });

  it('склонение «публикаций»', () => {
    expect([1, 2, 5, 11, 21].map(postsCount)).toEqual([
      '1 публикация',
      '2 публикации',
      '5 публикаций',
      '11 публикаций',
      '21 публикация',
    ]);
  });
});
