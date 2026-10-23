import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithStore } from '@/lib/test-utils';
import { uploadMedia } from '@/lib/api/upload';
import { CreateStoryDialog } from './create-story-dialog';

vi.mock('@/lib/api/upload', () => ({ uploadMedia: vi.fn() }));

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe('CreateStoryDialog', () => {
  it('загружает файл как STORY и создаёт историю', async () => {
    vi.mocked(uploadMedia).mockResolvedValue({ id: 'media-1', status: 'READY' } as never);
    const fetchMock = mockFetch([{ method: 'POST', path: '/stories', status: 201, body: {} }]);
    const onOpenChange = vi.fn();
    renderWithStore(<CreateStoryDialog open onOpenChange={onOpenChange} />);

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Выбрать фото или видео'), {
      target: { files: [file] },
    });
    expect(await screen.findByAltText('Предпросмотр истории')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Близкие друзья' }));
    fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(uploadMedia).toHaveBeenCalledWith(file, 'STORY', expect.any(Function));
    const request = fetchMock.mock.calls
      .map(([r]) => r as Request)
      .find((r) => r.method === 'POST' && r.url.endsWith('/stories'))!;
    expect(await request.clone().json()).toEqual({
      mediaId: 'media-1',
      audience: 'CLOSE_FRIENDS',
    });
  });

  it('при ошибке показывает текст и «Повторить»', async () => {
    vi.mocked(uploadMedia).mockRejectedValue({ status: 500, data: { message: 'Сбой загрузки' } });
    mockFetch([]);
    renderWithStore(<CreateStoryDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Выбрать фото или видео'), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Поделиться' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('«Повторить» не загружает файл заново', async () => {
    vi.mocked(uploadMedia).mockClear();
    vi.mocked(uploadMedia).mockResolvedValue({ id: 'media-1', status: 'READY' } as never);
    // Первый POST /stories падает, второй проходит.
    const results = [
      { status: 500, body: { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Сбой' } },
      { status: 201, body: {} },
    ];
    const route = {
      method: 'POST',
      path: '/stories',
      get status() {
        return results[0].status;
      },
      get body() {
        return (results.length > 1 ? results.shift()! : results[0]).body;
      },
    };
    mockFetch([route]);
    const onOpenChange = vi.fn();
    renderWithStore(<CreateStoryDialog open onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByLabelText('Выбрать фото или видео'), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Поделиться' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(uploadMedia).toHaveBeenCalledTimes(1);
  });
});
