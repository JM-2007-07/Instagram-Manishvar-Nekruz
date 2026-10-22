import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchContent, postsCount } from './search-content';

const removeEntry = vi.fn();
const clearHistory = vi.fn();
const addHistory = vi.fn();

type Q = Record<string, unknown>;
let history: Q;
let search: Q;

vi.mock('../api', () => ({
  useGetSearchHistoryInfiniteQuery: () => history,
  useSearchQuery: () => search,
  useAddSearchHistoryMutation: () => [addHistory, {}],
  useRemoveSearchHistoryEntryMutation: () => [removeEntry, {}],
  useClearSearchHistoryMutation: () => [clearHistory, { isLoading: false }],
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

describe('SearchContent', () => {
  beforeEach(() => {
    removeEntry.mockReset();
    clearHistory.mockReset();
    addHistory.mockReset();
    history = historyOf([]);
    search = { isLoading: false, isError: false, data: undefined };
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

  it('ввод → результаты: аккаунт, хэштег, место; клик пишет в историю', () => {
    search = {
      isLoading: false,
      isError: false,
      data: {
        users: [user],
        hashtags: [{ name: 'cats', postCount: 5 }],
        locations: [{ id: 'l1', name: 'Парк', slug: 'park', city: 'Минск', country: 'Беларусь' }],
      },
    };
    render(<SearchContent />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ca' } });

    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('#cats')).toBeInTheDocument();
    expect(screen.getByText('5 публикаций')).toBeInTheDocument();
    expect(screen.getByText('Парк')).toBeInTheDocument();

    fireEvent.click(screen.getByText('#cats'));
    expect(addHistory).toHaveBeenCalledWith({ type: 'HASHTAG', hashtagName: 'cats' });
  });

  it('нет результатов → «Ничего не найдено»', () => {
    search = { isLoading: false, isError: false, data: { users: [], hashtags: [], locations: [] } };
    render(<SearchContent />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
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
