import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveButton } from './save-button';

const savePost = vi.fn();
const showApiError = vi.fn();

vi.mock('../api', () => ({
  useSavePostMutation: () => [savePost, { isLoading: false }],
}));
vi.mock('./add-to-collection-dialog', () => ({ AddToCollectionDialog: () => null }));
vi.mock('@/lib/api/errors', () => ({ showApiError: (e: unknown) => showApiError(e) }));
vi.mock('sonner', () => ({ toast: vi.fn() }));

describe('SaveButton', () => {
  beforeEach(() => {
    savePost.mockReset();
    showApiError.mockReset();
  });

  it('меняет вид сразу, до ответа сервера', async () => {
    let resolve!: () => void;
    savePost.mockReturnValue({ unwrap: () => new Promise<void>((r) => (resolve = r)) });
    render(<SaveButton postId="p1" isSavedByMe={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(screen.getByRole('button', { name: 'Удалить из сохранённого' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(savePost).toHaveBeenCalledWith({ postId: 'p1', saved: true });
    resolve();
    await waitFor(() => expect(showApiError).not.toHaveBeenCalled());
  });

  it('при ошибке возвращает прежний вид и показывает ошибку', async () => {
    const error = { status: 500 };
    savePost.mockReturnValue({ unwrap: () => Promise.reject(error) });
    render(<SaveButton postId="p1" isSavedByMe={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(showApiError).toHaveBeenCalledWith(error));
    expect(screen.getByRole('button', { name: 'Сохранить' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('сохранённый пост снимается с сохранения', () => {
    savePost.mockReturnValue({ unwrap: () => new Promise<void>(() => undefined) });
    render(<SaveButton postId="p1" isSavedByMe />);
    fireEvent.click(screen.getByRole('button', { name: 'Удалить из сохранённого' }));
    expect(savePost).toHaveBeenCalledWith({ postId: 'p1', saved: false });
  });
});
