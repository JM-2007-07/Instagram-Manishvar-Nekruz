import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithStore } from '@/lib/test-utils';
import { makeStory, meDto } from '../test-data';
import { StoryPlayer } from './story-player';

const stories = [makeStory('s1'), makeStory('s2')];

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const widths = () => screen.getAllByTestId('story-progress').map((el) => el.style.width);
const requests = (fn: ReturnType<typeof mockFetch>) => fn.mock.calls.map(([r]) => r as Request);
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

async function renderPlayer(onClose = vi.fn()) {
  const fetchMock = mockFetch([
    { path: '/me', body: meDto },
    { method: 'PUT', path: /\/stories\/.+\/view/, status: 204 },
    { method: 'POST', path: /\/stories\/.+\/reply/, status: 201, body: {} },
  ]);
  renderWithStore(<StoryPlayer stories={stories} onClose={onClose} />);
  await advance(0);
  return { fetchMock, onClose };
}

describe('StoryPlayer', () => {
  it('прогресс идёт по таймеру, потом следующая история и закрытие в конце', async () => {
    const { onClose } = await renderPlayer();
    expect(widths()).toEqual(['0%', '0%']);

    await advance(2500);
    expect(widths()[0]).toBe('50%');

    await advance(2600);
    expect(widths()[0]).toBe('100%');
    expect(onClose).not.toHaveBeenCalled();

    await advance(5000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('клик вперёд и назад переключает истории', async () => {
    await renderPlayer();
    fireEvent.click(screen.getByRole('button', { name: 'Следующая история' }));
    expect(widths()).toEqual(['100%', '0%']);
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущая история' }));
    expect(widths()).toEqual(['0%', '0%']);
  });

  it('удержание ставит на паузу', async () => {
    await renderPlayer();
    const layer = screen.getByRole('button', { name: 'Следующая история' }).parentElement!;
    fireEvent.pointerDown(layer);
    await advance(1000);
    expect(widths()[0]).toBe('0%');
    fireEvent.pointerUp(layer);
  });

  it('просмотр отправляется один раз на историю', async () => {
    const { fetchMock } = await renderPlayer();
    await advance(1000);
    const views = requests(fetchMock).filter(
      (r) => r.method === 'PUT' && r.url.endsWith('/stories/s1/view'),
    );
    expect(views).toHaveLength(1);
  });

  it('ответ на историю уходит POST /reply', async () => {
    const { fetchMock } = await renderPlayer();
    const input = screen.getByLabelText('Ответьте пользователю alice');
    fireEvent.focus(input);
    expect(screen.getByRole('button', { name: /реакцию 🔥/ })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'Круто!' } });
    await act(async () => {
      fireEvent.submit(input.closest('form')!);
      await vi.advanceTimersByTimeAsync(0);
    });
    const reply = requests(fetchMock).find(
      (r) => r.method === 'POST' && r.url.endsWith('/stories/s1/reply'),
    )!;
    expect(await reply.clone().json()).toEqual({ text: 'Круто!' });
  });
});
