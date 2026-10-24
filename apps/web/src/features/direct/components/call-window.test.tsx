import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Call } from '@/lib/api/types';
import { CallWindow } from './call-manager';

vi.mock('@/lib/realtime', () => ({ useRealtimeEvent: vi.fn() }));
vi.mock('../api', () => ({}));

const session = {
  call: { id: 'c1', chatId: 'ch1', type: 'VIDEO' } as Call,
  isCaller: true,
  remoteName: 'bob',
  localStream: null as unknown as MediaStream,
  remoteStream: null,
};

function renderWindow(minimized: boolean) {
  const handlers = { onMinimize: vi.fn(), onEnd: vi.fn(), onToggleMic: vi.fn() };
  render(
    <CallWindow
      session={session}
      minimized={minimized}
      connectedAt={null}
      micOn
      cameraOn
      onToggleCamera={vi.fn()}
      {...handlers}
    />,
  );
  return handlers;
}

describe('CallWindow', () => {
  it('на весь экран: «Свернуть» и «Завершить»', () => {
    const h = renderWindow(false);
    expect(screen.getByRole('dialog', { name: 'Звонок' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Свернуть звонок' }));
    expect(h.onMinimize).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Завершить звонок' }));
    expect(h.onEnd).toHaveBeenCalledTimes(1);
  });

  it('свёрнутый: панель в углу, развернуть, микрофон и завершить', () => {
    const h = renderWindow(true);
    expect(screen.getByRole('dialog', { name: 'Звонок (свёрнут)' })).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Развернуть звонок' })[0]!);
    expect(h.onMinimize).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'Выключить микрофон' }));
    expect(h.onToggleMic).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Завершить звонок' }));
    expect(h.onEnd).toHaveBeenCalled();
  });
});
