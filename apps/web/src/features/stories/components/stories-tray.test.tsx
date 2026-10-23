import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithStore } from '@/lib/test-utils';
import { meDto, makeTrayItem } from '../test-data';
import { StoriesTray } from './stories-tray';

afterEach(() => vi.unstubAllGlobals());

describe('StoriesTray', () => {
  it('показывает «Ваша история» с плюсом и кольца авторов трёх видов', async () => {
    mockFetch([
      { path: '/me', body: meDto },
      {
        path: '/stories/tray',
        body: [
          makeTrayItem({ id: 'u1', userName: 'unseen_user' }),
          makeTrayItem({ id: 'u2', userName: 'seen_user', hasUnseen: false }),
          makeTrayItem({ id: 'u3', userName: 'friend_user', isCloseFriends: true }),
        ],
      },
    ]);
    const { container } = renderWithStore(<StoriesTray />);

    expect(await screen.findByText('unseen_user')).toBeInTheDocument();
    // у своей нет активной истории — кнопка создания, а не ссылка
    expect(screen.getByRole('button', { name: /Ваша история/ })).toBeInTheDocument();

    const kind = (name: string) =>
      screen.getByText(name).closest('a')!.querySelector('[data-ring]')!.getAttribute('data-ring');
    expect(kind('unseen_user')).toBe('unseen');
    expect(kind('seen_user')).toBe('seen');
    expect(kind('friend_user')).toBe('close-friends');
    expect(container.querySelector('a[href="/stories/unseen_user/s-unseen_user"]')).not.toBeNull();
  });

  it('своя активная история открывается ссылкой', async () => {
    mockFetch([
      { path: '/me', body: meDto },
      { path: '/stories/tray', body: [makeTrayItem({ id: meDto.id, userName: 'me' })] },
    ]);
    renderWithStore(<StoriesTray />);
    const link = await screen.findByRole('link', { name: /Ваша история/ });
    expect(link).toHaveAttribute('href', '/stories/me/s-me');
  });
});
