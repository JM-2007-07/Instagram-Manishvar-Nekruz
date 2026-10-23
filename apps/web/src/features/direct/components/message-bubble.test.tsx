import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Message, UserSummary } from '@/lib/api/types';
import { makeOptimisticMessage } from '../chat-utils';
import { isSeenByOthers, receiptsFromParticipants } from './chat-view';
import { MessageBubble } from './message-bubble';

vi.mock('../api', () => ({
  useReactToMessageMutation: () => [vi.fn()],
  useUnsendMessageMutation: () => [vi.fn()],
  useEditMessageMutation: () => [vi.fn(), { isLoading: false }],
  useGetChatQuery: vi.fn(),
}));
vi.mock('../realtime', () => ({}));
vi.mock('./call-manager', () => ({ useCall: vi.fn() }));
vi.mock('@/features/profile/api', () => ({ useGetMeQuery: vi.fn() }));

const me = { id: 'me', userName: 'me_user' } as UserSummary;
const anna = { id: 'u2', userName: 'anna', avatarUrl: null } as UserSummary;

function msg(id: string, sender: UserSummary, partial: Partial<Message> = {}): Message {
  return { ...makeOptimisticMessage('c1', sender, `cl-${id}`, partial), id };
}

describe('MessageBubble', () => {
  it('показывает реакции под сообщением', () => {
    const message = msg('m1', anna, {
      text: 'Привет',
      reactions: [{ emoji: '❤️', users: [me, anna] }],
    });
    render(
      <MessageBubble
        message={message}
        meId="me"
        me={me}
        showSender={false}
        showAvatar
        isFirstInGroup
        isLastInGroup
        onReply={vi.fn()}
      />,
    );
    expect(screen.getByText('Привет')).toBeInTheDocument();
    expect(screen.getByLabelText('Реакции')).toHaveTextContent('❤️2');
  });
});

describe('receiptsFromParticipants', () => {
  it('берёт lastReadMessageId участников и пропускает null', () => {
    expect(
      receiptsFromParticipants([
        { id: 'u2', lastReadMessageId: 'm3' },
        { id: 'me', lastReadMessageId: null },
      ]),
    ).toEqual({ u2: 'm3' });
  });
});

describe('isSeenByOthers', () => {
  const list = [msg('m3', anna), msg('m2', me), msg('m1', anna)]; // новые сначала

  it('«Просмотрено», если собеседник прочитал моё последнее сообщение или новее', () => {
    expect(isSeenByOthers(list, { u2: 'm3' }, 'me')).toBe(true);
    expect(isSeenByOthers(list, { u2: 'm2' }, 'me')).toBe(true);
  });

  it('не «Просмотрено», если прочитано только более старое', () => {
    expect(isSeenByOthers(list, { u2: 'm1' }, 'me')).toBe(false);
    expect(isSeenByOthers(list, {}, 'me')).toBe(false);
  });
});
