import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Chat } from '@/lib/api/types';
import { ChatList } from './chat-list';

const chatsState = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock('../api', () => ({ useGetChatsInfiniteQuery: () => chatsState.value }));
vi.mock('@/features/profile/api', () => ({
  useGetMeQuery: () => ({ data: { id: 'me', userName: 'me_user' } }),
}));

function makeChat(partial: Partial<Chat>): Chat {
  return {
    id: 'c1',
    type: 'DIRECT',
    title: null,
    avatarUrl: null,
    participants: [
      { id: 'me', userName: 'me_user', isOnline: false, role: 'MEMBER' },
      { id: 'u2', userName: 'anna', isOnline: true, role: 'MEMBER' },
    ] as Chat['participants'],
    lastMessage: null,
    unreadCount: 0,
    isMuted: false,
    isRequest: false,
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe('ChatList', () => {
  it('показывает пустое состояние', () => {
    chatsState.value = { data: { pages: [{ items: [], nextCursor: null }] }, isLoading: false };
    render(<ChatList />);
    expect(screen.getByText('Пока нет сообщений')).toBeInTheDocument();
  });

  it('показывает чат с непрочитанным сообщением', () => {
    chatsState.value = {
      data: { pages: [{ items: [makeChat({ unreadCount: 2 })], nextCursor: null }] },
      isLoading: false,
    };
    render(<ChatList />);
    expect(screen.getByText('anna')).toBeInTheDocument();
    expect(screen.getByLabelText('Непрочитанных: 2')).toBeInTheDocument();
  });

  it('показывает ошибку с кнопкой «Повторить»', () => {
    chatsState.value = { isError: true, error: { status: 500 }, refetch: vi.fn() };
    render(<ChatList />);
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});
