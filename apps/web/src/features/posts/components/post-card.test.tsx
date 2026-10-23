import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithStore } from '@/lib/test-utils';
import { makePost } from '../test-fixtures';
import { PostCard } from './post-card';

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

const LIKES_5 = '5 отметок "Нравится"';
const LIKES_6 = '6 отметок "Нравится"';

describe('PostCard', () => {
  it('показывает автора, число лайков и ссылку на комментарии', () => {
    mockFetch([{ path: '/me', body: { id: 'x' } }]);
    renderWithStore(<PostCard post={makePost()} />);
    expect(screen.getAllByText('alice').length).toBeGreaterThan(0);
    expect(screen.getByText(LIKES_5)).toBeInTheDocument();
    expect(screen.getByText('Посмотреть все комментарии (3)')).toHaveAttribute(
      'href',
      expect.stringContaining('/p/abc123'),
    );
  });

  it('лайк меняет счётчик сразу', () => {
    mockFetch([{ method: 'PUT', path: '/posts/p1/like', status: 204 }]);
    renderWithStore(<PostCard post={makePost()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Нравится' }));
    expect(screen.getByText(LIKES_6)).toBeInTheDocument();
  });

  it('откатывает лайк при ошибке', async () => {
    mockFetch([
      { method: 'PUT', path: '/posts/p1/like', status: 500, body: { code: 'INTERNAL_ERROR' } },
    ]);
    renderWithStore(<PostCard post={makePost()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Нравится' }));
    await waitFor(() => expect(screen.getByText(LIKES_5)).toBeInTheDocument());
  });

  it('двойной клик по медиа ставит лайк и не снимает его', () => {
    mockFetch([{ method: 'PUT', path: '/posts/p1/like', status: 204 }]);
    renderWithStore(<PostCard post={makePost()} />);
    const img = screen.getByAltText('Фото публикации');
    fireEvent.doubleClick(img);
    expect(screen.getByText(LIKES_6)).toBeInTheDocument();
    expect(screen.getByTestId('big-heart')).toBeInTheDocument();
    fireEvent.doubleClick(img);
    expect(screen.getByText(LIKES_6)).toBeInTheDocument();
  });

  it('скрывает число лайков, если автор его скрыл', () => {
    mockFetch([]);
    renderWithStore(<PostCard post={makePost({ hideLikeCount: true, likeCount: null })} />);
    expect(screen.queryByText(/отметок/)).not.toBeInTheDocument();
  });
});
