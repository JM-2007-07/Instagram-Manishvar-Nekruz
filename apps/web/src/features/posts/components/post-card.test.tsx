import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithStore } from '@/lib/test-utils';
import { makePost } from '../test-fixtures';
import { PostCard } from './post-card';

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

const likes = () => screen.getByTestId('like-count');

describe('PostCard', () => {
  it('показывает автора, число лайков и ссылку на комментарии', () => {
    mockFetch([{ path: '/me', body: { id: 'x' } }]);
    renderWithStore(<PostCard post={makePost()} />);
    expect(screen.getAllByText('alice').length).toBeGreaterThan(0);
    expect(likes()).toHaveTextContent('5');
    expect(screen.getByTestId('comment-count')).toHaveTextContent('3');
    expect(screen.getByText('Посмотреть все комментарии (3)')).toHaveAttribute(
      'href',
      expect.stringContaining('/p/abc123'),
    );
  });

  it('лайк меняет счётчик сразу', () => {
    mockFetch([{ method: 'PUT', path: '/posts/p1/like', status: 204 }]);
    renderWithStore(<PostCard post={makePost()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Нравится' }));
    expect(likes()).toHaveTextContent('6');
  });

  it('откатывает лайк при ошибке', async () => {
    mockFetch([
      { method: 'PUT', path: '/posts/p1/like', status: 500, body: { code: 'INTERNAL_ERROR' } },
    ]);
    renderWithStore(<PostCard post={makePost()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Нравится' }));
    await waitFor(() => expect(likes()).toHaveTextContent('5'));
  });

  it('двойной клик по медиа ставит лайк и не снимает его', () => {
    mockFetch([{ method: 'PUT', path: '/posts/p1/like', status: 204 }]);
    renderWithStore(<PostCard post={makePost()} />);
    const img = screen.getByAltText('Фото публикации');
    fireEvent.doubleClick(img);
    expect(likes()).toHaveTextContent('6');
    expect(screen.getByTestId('big-heart')).toBeInTheDocument();
    fireEvent.doubleClick(img);
    expect(likes()).toHaveTextContent('6');
  });

  it('скрывает число лайков, если автор его скрыл', () => {
    mockFetch([]);
    renderWithStore(<PostCard post={makePost({ hideLikeCount: true, likeCount: null })} />);
    expect(screen.queryByTestId('like-count')).not.toBeInTheDocument();
  });
});
