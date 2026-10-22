import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '@/lib/api/types';
import { NotificationsList } from './notifications-list';

const query = vi.fn();
const badges = vi.fn();
const markRead = vi.fn(() => ({ unwrap: () => Promise.resolve() }));

vi.mock('../api', () => ({
  useGetNotificationsInfiniteQuery: () => query(),
  useGetBadgesQuery: () => badges(),
  useMarkNotificationsReadMutation: () => [markRead, { isLoading: false }],
}));

function notification(id: string, daysAgo: number, patch: Partial<Notification> = {}) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    id,
    type: 'POST_LIKE',
    actors: [
      {
        id: 'u1',
        userName: 'bob',
        fullName: 'Bob',
        avatarUrl: null,
        isVerified: false,
        isPrivate: false,
        hasActiveStory: false,
        isCloseFriendStory: false,
      },
    ],
    actorCount: 1,
    post: { id: 'p1', shortcode: 'abc', thumbnailUrl: '/thumb.jpg' },
    comment: null,
    isRead: false,
    createdAt: date.toISOString(),
    ...patch,
  } as Notification;
}

function loaded(items: Notification[]) {
  query.mockReturnValue({
    data: { pages: [{ items, nextCursor: null }] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  });
}

describe('NotificationsList', () => {
  beforeEach(() => {
    query.mockReset();
    badges.mockReturnValue({ data: { unreadNotifications: 0, unreadChats: 0, followRequests: 0 } });
    markRead.mockClear();
  });

  it('показывает группы по времени и миниатюру поста', () => {
    loaded([notification('1', 0), notification('2', 3), notification('3', 100)]);
    render(<NotificationsList />);
    expect(screen.getByRole('region', { name: 'Сегодня' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'На этой неделе' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Ранее' })).toBeInTheDocument();
    expect(screen.getAllByAltText('Миниатюра публикации')).toHaveLength(3);
    expect(screen.getAllByText('bob')).toHaveLength(3);
  });

  it('отмечает уведомления прочитанными при открытии', () => {
    loaded([notification('1', 0)]);
    render(<NotificationsList />);
    expect(markRead).toHaveBeenCalledTimes(1);
  });

  it('пустой список — пояснение', () => {
    loaded([]);
    render(<NotificationsList />);
    expect(screen.getByText('Действия с вашими публикациями')).toBeInTheDocument();
  });

  it('показывает ссылку на запросы на подписку', () => {
    badges.mockReturnValue({ data: { unreadNotifications: 0, unreadChats: 0, followRequests: 2 } });
    loaded([]);
    render(<NotificationsList />);
    expect(screen.getByRole('link', { name: /Запросы на подписку/ })).toBeInTheDocument();
  });

  it('ошибка — кнопка «Повторить»', () => {
    query.mockReturnValue({ isLoading: false, isError: true, refetch: vi.fn() });
    render(<NotificationsList />);
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('загрузка — skeleton', () => {
    query.mockReturnValue({ isLoading: true });
    render(<NotificationsList />);
    expect(screen.getByLabelText('Загрузка')).toBeInTheDocument();
  });
});
