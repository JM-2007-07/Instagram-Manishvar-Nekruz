import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makePost } from '../test-fixtures';
import { PostMedia } from './post-media';

const base = makePost().items[0];
const three = [0, 1, 2].map((position) => ({ ...base, position, altText: `фото ${position}` }));

describe('PostMedia', () => {
  it('одно фото: без стрелок и точек', () => {
    render(<PostMedia items={[base]} />);
    expect(screen.queryByRole('button', { name: 'Далее' })).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('dot')).toHaveLength(0);
  });

  it('карусель: стрелки листают, точки показывают позицию', () => {
    render(<PostMedia items={three} />);
    expect(screen.getAllByTestId('dot')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Назад' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    expect(screen.getByAltText('фото 1')).toBeInTheDocument();
    expect(screen.getAllByTestId('dot')[1]).toHaveAttribute('data-active', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    expect(screen.queryByRole('button', { name: 'Далее' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByAltText('фото 1')).toBeInTheDocument();
  });
});
