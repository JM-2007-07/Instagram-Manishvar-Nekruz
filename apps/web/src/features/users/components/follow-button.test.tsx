import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FollowButton } from './follow-button';

const follow = vi.fn();
const unfollow = vi.fn();
const showApiError = vi.fn();

vi.mock('../api', () => ({
  useFollowUserMutation: () => [follow, { isLoading: false }],
  useUnfollowUserMutation: () => [unfollow, { isLoading: false }],
}));
vi.mock('@/lib/api/errors', () => ({ showApiError: (e: unknown) => showApiError(e) }));

const ok = (value?: unknown) => ({ unwrap: () => Promise.resolve(value) });
const fail = (error: unknown) => ({ unwrap: () => Promise.reject(error) });

describe('FollowButton', () => {
  beforeEach(() => {
    follow.mockReset();
    unfollow.mockReset();
    showApiError.mockReset();
  });

  it('показывает подпись по состоянию', () => {
    const { rerender } = render(<FollowButton userId="u1" followStatus="NONE" />);
    expect(screen.getByRole('button', { name: 'Подписаться' })).toBeInTheDocument();
    rerender(<FollowButton userId="u1" followStatus="FOLLOWING" />);
    expect(screen.getByRole('button', { name: 'Подписки' })).toBeInTheDocument();
    rerender(<FollowButton userId="u1" followStatus="REQUESTED" />);
    expect(screen.getByRole('button', { name: 'Запрос отправлен' })).toBeInTheDocument();
  });

  it('NONE → FOLLOWING после успешной подписки', async () => {
    follow.mockReturnValue(ok({ status: 'ACCEPTED' }));
    render(<FollowButton userId="u1" followStatus="NONE" />);
    fireEvent.click(screen.getByRole('button'));
    expect(follow).toHaveBeenCalledWith('u1');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Подписки' })).toBeInTheDocument(),
    );
  });

  it('закрытый аккаунт: ответ PENDING → «Запрос отправлен»', async () => {
    follow.mockReturnValue(ok({ status: 'PENDING' }));
    render(<FollowButton userId="u1" followStatus="NONE" isPrivate />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Запрос отправлен' })).toBeInTheDocument(),
    );
  });

  it('FOLLOWING → NONE при отписке', async () => {
    unfollow.mockReturnValue(ok());
    render(<FollowButton userId="u1" followStatus="FOLLOWING" />);
    fireEvent.click(screen.getByRole('button'));
    expect(unfollow).toHaveBeenCalledWith('u1');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Подписаться' })).toBeInTheDocument(),
    );
  });

  it('при ошибке возвращает прежнее состояние и показывает ошибку', async () => {
    const error = { status: 500 };
    follow.mockReturnValue(fail(error));
    render(<FollowButton userId="u1" followStatus="NONE" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(showApiError).toHaveBeenCalledWith(error));
    expect(screen.getByRole('button', { name: 'Подписаться' })).toBeInTheDocument();
  });
});
