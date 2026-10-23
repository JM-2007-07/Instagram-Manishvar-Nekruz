import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { mockFetch, renderWithStore } from '@/lib/test-utils';
import { uploadMedia } from '@/lib/api/upload';
import { CreatePostDialog } from './create-post-dialog';

vi.mock('@/lib/api/upload');
vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

const me = { id: 'u1', userName: 'nek', fullName: 'Nek', avatarUrl: null };
const media = { id: 'm1', kind: 'IMAGE', status: 'READY', url: '/x' };

function setup(routes: Parameters<typeof mockFetch>[0] = []) {
  const fetchMock = mockFetch([{ path: '/me', body: me }, ...routes]);
  const onClose = vi.fn();
  renderWithStore(<CreatePostDialog onClose={onClose} />);
  return { fetchMock, onClose };
}

async function pick(count = 1) {
  const files = Array.from(
    { length: count },
    (_, i) => new File(['a'], `a${i}.png`, { type: 'image/png' }),
  );
  fireEvent.change(screen.getByLabelText('Выбрать файлы'), { target: { files } });
}

describe('CreatePostDialog', () => {
  it('выбор файла открывает шаг обрезки, затем подпись со счётчиком', async () => {
    setup();
    expect(screen.getByText('Перетащите сюда фото и видео')).toBeInTheDocument();
    await pick();
    expect(screen.getByText('Обрезать')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    const caption = screen.getByLabelText('Подпись');
    fireEvent.change(caption, { target: { value: 'abc' } });
    expect(screen.getByText('3/2 200')).toBeInTheDocument();
  });

  it('публикация загружает файл, шлёт POST /posts и показывает успех', async () => {
    vi.mocked(uploadMedia).mockResolvedValue(media as never);
    const { fetchMock } = setup([
      { method: 'POST', path: '/posts', status: 201, body: { id: 'p1' } },
    ]);
    await pick();
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }));
    expect(await screen.findByText('Ваша публикация опубликована')).toBeInTheDocument();
    expect(uploadMedia).toHaveBeenCalledWith(expect.any(File), 'POST', expect.any(Function));
    const call = fetchMock.mock.calls.find(([r]) => (r as Request).method === 'POST');
    expect(call).toBeTruthy();
  });

  it('ошибка показывает «Повторить»', async () => {
    vi.mocked(uploadMedia).mockResolvedValue(media as never);
    setup([
      {
        method: 'POST',
        path: '/posts',
        status: 409,
        body: { statusCode: 409, code: 'MEDIA_NOT_READY', message: 'x' },
      },
    ]);
    await pick();
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }));
    expect(await screen.findByText('Файл ещё обрабатывается')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('закрытие с файлами спрашивает подтверждение', async () => {
    const { onClose } = setup();
    await pick();
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(screen.getByText('Удалить публикацию?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('закрытие без файлов не спрашивает', async () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalled();
  });
});
