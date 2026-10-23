import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UserSummary } from '@/lib/api/types';
import { MessageComposer } from './message-composer';

const send = vi.hoisted(() => vi.fn());
vi.mock('../api', () => ({
  useSendMessageMutation: () => [(arg: unknown) => ({ unwrap: () => Promise.resolve(send(arg)) })],
}));

vi.mock('react-redux', () => ({ useDispatch: () => vi.fn() }));
vi.mock('@/features/create-post/api', () => ({ waitForMediaReady: vi.fn() }));
const upload = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/upload', () => ({ uploadMedia: upload }));

const me = { id: 'me', userName: 'me_user' } as UserSummary;

function renderComposer() {
  return render(
    <MessageComposer
      chatId="c1"
      me={me}
      replyTo={null}
      onClearReply={vi.fn()}
      onTyping={vi.fn()}
    />,
  );
}

describe('MessageComposer', () => {
  it('отправляет текст оптимистично с clientId', () => {
    send.mockClear();
    render(
      <MessageComposer
        chatId="c1"
        me={me}
        replyTo={null}
        onClearReply={vi.fn()}
        onTyping={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Сообщение'), { target: { value: 'Привет' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    const arg = send.mock.calls[0]![0] as {
      chatId: string;
      body: { type: string; text: string; clientId: string };
      optimistic: { id: string; clientId: string; text: string };
    };
    expect(arg.body).toMatchObject({ type: 'TEXT', text: 'Привет' });
    expect(arg.body.clientId).toBeTruthy();
    expect(arg.optimistic.id).toBe(`tmp-${arg.body.clientId}`);
    expect(arg.optimistic.clientId).toBe(arg.body.clientId);
  });

  it('эмодзи-панель закрывается после выбора, по Escape и по клику мимо', () => {
    renderComposer();
    const toggle = screen.getByRole('button', { name: 'Эмодзи' });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Вставить 😂' }));
    expect(screen.queryByRole('dialog', { name: 'Эмодзи' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Сообщение')).toHaveValue('😂');

    fireEvent.click(toggle);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Эмодзи' })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog', { name: 'Эмодзи' })).not.toBeInTheDocument();
  });

  it('отменённая запись голоса ничего не отправляет и выключает микрофон', async () => {
    send.mockClear();
    upload.mockClear();
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] };
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => Promise.resolve(stream) } });
    class FakeRecorder {
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['x']) });
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder);

    renderComposer();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Голосовое сообщение' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Запись 0:00');
    fireEvent.click(screen.getByRole('button', { name: 'Отменить запись' }));

    expect(stopTrack).toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Голосовое сообщение' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
