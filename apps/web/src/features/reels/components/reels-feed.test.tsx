import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { mockFetch, renderWithStore } from '@/lib/test-utils';
import { ReelsFeed } from './reels-feed';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const author = {
  id: 'u2',
  userName: 'anna',
  fullName: 'Anna',
  avatarUrl: null,
  isVerified: false,
  isPrivate: false,
  hasActiveStory: false,
  isCloseFriendStory: false,
};

function reel(id: string, over = {}) {
  return {
    id,
    shortcode: `sc${id}`,
    type: 'REEL',
    author,
    items: [
      {
        position: 0,
        media: { id: `m${id}`, kind: 'VIDEO', url: `/v${id}.mp4`, thumbnailUrl: null },
      },
    ],
    caption: `Подпись ${id}`,
    likeCount: 5,
    commentCount: 2,
    isLikedByMe: false,
    isSavedByMe: false,
    ...over,
  };
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const me = { method: 'GET', path: '/me', body: { id: 'me1' } };

describe('ReelsFeed', () => {
  it('показывает ролики', async () => {
    mockFetch([me, { path: '/reels', body: { items: [reel('1'), reel('2')], nextCursor: null } }]);
    renderWithStore(<ReelsFeed />);
    expect(await screen.findByText('Подпись 1')).toBeTruthy();
    expect(screen.getByText('Подпись 2')).toBeTruthy();
  });

  it('лайк оптимистичен', async () => {
    const fetchFn = mockFetch([
      me,
      { path: '/reels', body: { items: [reel('1')], nextCursor: null } },
      { method: 'PUT', path: '/posts/1/like', status: 204 },
    ]);
    renderWithStore(<ReelsFeed />);
    const like = (await screen.findAllByRole('button', { name: 'Нравится', hidden: true }))[0];
    fireEvent.click(like);
    expect((await screen.findAllByText('6')).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(fetchFn.mock.calls.some(([r]) => (r as Request).method === 'PUT')).toBe(true),
    );
  });

  it('откатывает лайк при ошибке', async () => {
    mockFetch([
      me,
      { path: '/reels', body: { items: [reel('1')], nextCursor: null } },
      { method: 'PUT', path: '/posts/1/like', status: 500, body: { message: 'err' } },
    ]);
    renderWithStore(<ReelsFeed />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Нравится', hidden: true }))[0]);
    await waitFor(() => expect(screen.queryAllByText('6').length).toBe(0));
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);
  });

  it('пусто', async () => {
    mockFetch([me, { path: '/reels', body: { items: [], nextCursor: null } }]);
    renderWithStore(<ReelsFeed />);
    expect(await screen.findByText('Пока нет Reels')).toBeTruthy();
  });

  it('ошибка с кнопкой «Повторить»', async () => {
    mockFetch([me, { path: '/reels', status: 500, body: { message: 'err' } }]);
    renderWithStore(<ReelsFeed />);
    expect(await screen.findByRole('button', { name: 'Повторить' })).toBeTruthy();
  });

  it('plays отправляется один раз', async () => {
    const fetchFn = mockFetch([
      me,
      { path: '/reels', body: { items: [reel('1')], nextCursor: null } },
      { method: 'POST', path: '/posts/1/plays', status: 204 },
    ]);
    renderWithStore(<ReelsFeed />);
    const video = await screen.findByLabelText('Reel: anna');
    fireEvent.play(video);
    fireEvent.play(video);
    await waitFor(() => {
      const plays = fetchFn.mock.calls.filter(([r]) => (r as Request).url.endsWith('/plays'));
      expect(plays.length).toBe(1);
    });
  });

  it('кнопка звука переключает muted', async () => {
    mockFetch([me, { path: '/reels', body: { items: [reel('1')], nextCursor: null } }]);
    renderWithStore(<ReelsFeed />);
    const video = (await screen.findByLabelText('Reel: anna')) as HTMLVideoElement;
    expect(video.muted).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Включить звук' }));
    expect(video.muted).toBe(false);
  });
});
