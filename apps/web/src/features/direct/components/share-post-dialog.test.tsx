import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SharePostDialog } from './share-post-dialog';

const share = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());
vi.mock('@/features/profile/api', () => ({ useGetMeQuery: () => ({ data: { id: 'me' } }) }));
vi.mock('@/features/search/user-search', () => ({
  useAccountSearch: () => ({ data: undefined, isPending: false }),
}));
vi.mock('@/features/users/use-debounced-value', () => ({ useDebouncedValue: <T,>(v: T) => v }));
vi.mock('../api', () => ({
  useGetChatsInfiniteQuery: () => ({
    isLoading: false,
    data: {
      pages: [
        {
          items: [
            {
              id: 'c1',
              type: 'DIRECT',
              title: null,
              avatarUrl: null,
              participants: [
                { id: 'me', userName: 'me' },
                { id: 'b', userName: 'bob', avatarUrl: null },
              ],
            },
          ],
        },
      ],
    },
  }),
  useSharePostMutation: () => [
    (arg: unknown) => ({ unwrap: () => Promise.resolve(share(arg)) }),
    { isLoading: false },
  ],
  useSendMessageMutation: () => [(arg: unknown) => ({ unwrap: () => Promise.resolve(send(arg)) })],
}));

describe('SharePostDialog', () => {
  it('закрыто — ничего не рисует', () => {
    render(<SharePostDialog postId="p1" shortcode="abc" open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('Поделиться')).not.toBeInTheDocument();
  });

  it('без выбора — «Копировать ссылку»; выбрал чат — сообщение и «Отправить» в этот чат', async () => {
    share.mockReturnValue({ messages: [{ chatId: 'c1' }] });
    const onOpenChange = vi.fn();
    render(<SharePostDialog postId="p1" shortcode="abc" open onOpenChange={onOpenChange} />);
    expect(screen.getByRole('button', { name: /Копировать ссылку/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Отправить' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'bob' }));
    fireEvent.change(screen.getByLabelText('Сообщение'), { target: { value: 'Глянь' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(share).toHaveBeenCalledWith({ postId: 'p1', chatIds: ['c1'], userIds: [] });
    expect(send.mock.calls[0]![0]).toMatchObject({
      chatId: 'c1',
      body: { type: 'TEXT', text: 'Глянь' },
    });
  });
});
