import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UserSummary } from '@/lib/api/types';
import { MessageComposer } from './message-composer';

const send = vi.hoisted(() => vi.fn());
vi.mock('../api', () => ({
  useSendMessageMutation: () => [(arg: unknown) => ({ unwrap: () => Promise.resolve(send(arg)) })],
}));

const me = { id: 'me', userName: 'me_user' } as UserSummary;

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
});
