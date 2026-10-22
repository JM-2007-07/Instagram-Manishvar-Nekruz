import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { APP_NAME } from '@/lib/config';
import { BrandLogo } from './brand-logo';

describe('BrandLogo', () => {
  it('показывает название приложения из конфигурации', () => {
    render(<BrandLogo />);
    expect(screen.getByText(APP_NAME)).toBeInTheDocument();
  });

  it('добавляет переданный className', () => {
    render(<BrandLogo className="custom" />);
    expect(screen.getByText(APP_NAME)).toHaveClass('custom');
  });
});
