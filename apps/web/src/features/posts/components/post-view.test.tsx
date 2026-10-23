import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithStore } from '@/lib/test-utils';
import { makePost } from '../test-fixtures';
import { PostView } from './post-view';

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

describe('PostView', () => {
  it('показывает skeleton, затем пост', async () => {
    mockFetch([
      { path: '/posts/by-shortcode/abc123', body: makePost() },
      { path: '/me', body: { id: 'me' } },
    ]);
    renderWithStore(<PostView shortcode="abc123" variant="page" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(await screen.findByText('5 отметок "Нравится"')).toBeInTheDocument();
  });

  it('404 — сообщение и ссылка на главную', async () => {
    mockFetch([]);
    renderWithStore(<PostView shortcode="nope" variant="page" />);
    expect(await screen.findByText('К сожалению, эта страница недоступна.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Вернуться на главную' })).toHaveAttribute('href', '/');
  });

  it('403 PRIVATE_ACCOUNT', async () => {
    mockFetch([
      {
        path: '/posts/by-shortcode/closed',
        status: 403,
        body: { statusCode: 403, code: 'PRIVATE_ACCOUNT', message: 'x' },
      },
    ]);
    renderWithStore(<PostView shortcode="closed" variant="modal" />);
    expect(await screen.findByText('Это закрытый аккаунт')).toBeInTheDocument();
  });
});
