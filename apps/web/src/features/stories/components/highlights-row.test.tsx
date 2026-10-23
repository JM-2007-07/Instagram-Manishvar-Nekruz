import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithStore } from '@/lib/test-utils';
import { HighlightsRow } from './highlights-row';

afterEach(() => vi.unstubAllGlobals());

const highlights = [{ id: 'h1', title: 'Лето', coverUrl: null, storyCount: 2 }];

describe('HighlightsRow', () => {
  it('для своего профиля есть «Новое», круг ведёт на просмотр актуального', async () => {
    mockFetch([
      { path: '/users/u1/highlights', body: highlights },
      { path: '/me/archive/stories', body: { items: [], nextCursor: null } },
    ]);
    renderWithStore(<HighlightsRow userId="u1" isMe />);

    const link = await screen.findByRole('link', { name: /Лето/ });
    expect(link).toHaveAttribute('href', '/stories/highlights/h1');

    fireEvent.click(screen.getByRole('button', { name: /Новое/ }));
    expect(await screen.findByText('Новое актуальное')).toBeInTheDocument();
    expect(await screen.findByText('В архиве пока нет историй')).toBeInTheDocument();
  });

  it('у чужого профиля без актуального ничего не показывает', async () => {
    mockFetch([{ path: '/users/u1/highlights', body: [] }]);
    const { container } = renderWithStore(<HighlightsRow userId="u1" isMe={false} />);
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
