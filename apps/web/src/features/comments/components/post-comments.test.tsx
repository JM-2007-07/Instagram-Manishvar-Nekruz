import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { mockFetch, renderWithStore } from '@/lib/test-utils';
import type { Post } from '@/features/posts/types';
import { CommentForm, CommentThreadProvider, PostComments } from './post-comments';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const user = (id: string, userName: string) => ({
  id,
  userName,
  fullName: userName,
  avatarUrl: null,
  isVerified: false,
  isPrivate: false,
  hasActiveStory: false,
  isCloseFriendStory: false,
});

const post = (over: Partial<Post> = {}) =>
  ({ id: 'p1', author: user('u-author', 'author'), commentsDisabled: false, ...over }) as Post;

const comment = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  postId: 'p1',
  parentId: null,
  author: user('u-other', 'maria'),
  text: 'Красиво @author',
  likeCount: 0,
  isLikedByMe: false,
  replyCount: 0,
  isPinned: false,
  isPendingApproval: false,
  editedAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});

// user-event в проекте нет: клик и ввод через fireEvent.
const userEvent = {
  click: async (el: Element) => {
    fireEvent.pointerDown(el);
    fireEvent.click(el);
  },
  type: async (el: Element, text: string) => {
    const [value, key] = text.split('{Enter}');
    fireEvent.change(el, { target: { value: (el as HTMLTextAreaElement).value + value } });
    if (key !== undefined) fireEvent.keyDown(el, { key: 'Enter' });
  },
};

const page = (items: unknown[]) => ({ items, nextCursor: null });
const me = (id: string) => ({ path: '/me', body: { id, userName: 'me' } });

afterEach(() => vi.unstubAllGlobals());

describe('PostComments', () => {
  it('показывает комментарии и раскрывает ответы', async () => {
    mockFetch([
      me('u-me'),
      { path: '/posts/p1/comments', body: page([comment({ replyCount: 1 })]) },
      {
        path: '/comments/c1/replies',
        body: page([
          comment({ id: 'c2', parentId: 'c1', text: 'Спасибо', author: user('u-a', 'anna') }),
        ]),
      },
    ]);
    renderWithStore(<PostComments post={post()} />);
    expect(await screen.findByText('maria')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Посмотреть ответы (1)'));
    expect(await screen.findByText('Спасибо')).toBeInTheDocument();
    expect(screen.getByText('Скрыть ответы')).toBeInTheDocument();
  });

  it('лайк меняется сразу и уходит PUT-запросом', async () => {
    const fetchMock = mockFetch([
      me('u-me'),
      { path: '/posts/p1/comments', body: page([comment()]) },
      { method: 'PUT', path: '/comments/c1/like', status: 204 },
    ]);
    renderWithStore(<PostComments post={post()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Нравится' }));
    expect(screen.getByRole('button', { name: 'Не нравится' })).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([r]) => (r as Request).method === 'PUT')).toBe(true),
    );
  });

  it('удаление требует подтверждения', async () => {
    const fetchMock = mockFetch([
      me('u-me'),
      { path: '/posts/p1/comments', body: page([comment({ author: user('u-me', 'me') })]) },
      { method: 'DELETE', path: '/comments/c1', status: 204 },
    ]);
    renderWithStore(<PostComments post={post()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Параметры комментария' }));
    await userEvent.click(await screen.findByText('Удалить'));
    expect(await screen.findByText('Удалить комментарий?')).toBeInTheDocument();
    const deletes = () =>
      fetchMock.mock.calls.filter(([r]) => (r as Request).method === 'DELETE').length;
    expect(deletes()).toBe(0);
    const buttons = screen.getAllByRole('button', { name: 'Удалить' });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(deletes()).toBe(1));
  });

  it('«Одобрить» видит только автор поста', async () => {
    const pending = comment({ isPendingApproval: true });
    mockFetch([me('u-author'), { path: '/posts/p1/comments', body: page([pending]) }]);
    const first = renderWithStore(<PostComments post={post()} />);
    expect(await screen.findByText('Одобрить')).toBeInTheDocument();
    first.unmount();

    mockFetch([me('u-someone'), { path: '/posts/p1/comments', body: page([pending]) }]);
    renderWithStore(<PostComments post={post()} />);
    await screen.findByText('maria');
    expect(screen.queryByText('Одобрить')).not.toBeInTheDocument();
  });

  it('пустое состояние', async () => {
    mockFetch([me('u-me'), { path: '/posts/p1/comments', body: page([]) }]);
    renderWithStore(<PostComments post={post()} />);
    expect(await screen.findByText('Комментариев пока нет.')).toBeInTheDocument();
    expect(screen.getByText('Начните переписку.')).toBeInTheDocument();
  });

  it('комментарии отключены', () => {
    mockFetch([]);
    renderWithStore(
      <CommentThreadProvider postId="p1">
        <PostComments post={post({ commentsDisabled: true })} />
        <CommentForm post={post({ commentsDisabled: true })} />
      </CommentThreadProvider>,
    );
    expect(screen.getByText('Комментарии к этой публикации отключены')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Добавьте комментарий…')).not.toBeInTheDocument();
  });
});

describe('CommentForm', () => {
  it('Enter отправляет комментарий', async () => {
    const fetchMock = mockFetch([
      { method: 'POST', path: '/posts/p1/comments', status: 201, body: comment() },
    ]);
    renderWithStore(<CommentForm post={post()} />);
    await userEvent.type(screen.getByPlaceholderText('Добавьте комментарий…'), 'Привет{Enter}');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(JSON.parse(await request.text())).toEqual({ text: 'Привет' });
  });

  it('«Ответить» подставляет @имя и отправляет parentId', async () => {
    const fetchMock = mockFetch([
      me('u-me'),
      { path: '/posts/p1/comments', body: page([comment()]) },
      { method: 'POST', path: '/posts/p1/comments', status: 201, body: comment({ id: 'c9' }) },
    ]);
    renderWithStore(
      <CommentThreadProvider postId="p1">
        <PostComments post={post()} />
        <CommentForm post={post()} />
      </CommentThreadProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Ответить' }));
    const input = screen.getByPlaceholderText('Добавьте комментарий…');
    expect(input).toHaveValue('@maria ');
    await userEvent.type(input, 'спасибо{Enter}');
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([r]) => (r as Request).method === 'POST')).toBe(true),
    );
    const request = fetchMock.mock.calls
      .map(([r]) => r as Request)
      .find((r) => r.method === 'POST')!;
    expect(JSON.parse(await request.text())).toEqual({ text: '@maria спасибо', parentId: 'c1' });
  });
});
