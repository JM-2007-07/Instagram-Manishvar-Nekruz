import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  describe('файл логотипа в public/brand', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it('показывает картинку логотипа и знака, если файлы найдены', async () => {
      vi.stubEnv('NEXT_PUBLIC_BRAND_LOGO', '/brand/logo.svg');
      vi.stubEnv('NEXT_PUBLIC_BRAND_MARK', '/brand/mark.png');
      vi.resetModules();
      const { BrandLogo: Logo } = await import('./brand-logo');
      const { container } = render(
        <>
          <Logo />
          <Logo variant="mark" />
        </>,
      );
      const [logo, mark] = container.querySelectorAll('img');
      expect(logo).toHaveAttribute('src', '/brand/logo.svg');
      expect(logo).toHaveAttribute('alt', APP_NAME);
      expect(mark).toHaveAttribute('src', '/brand/mark.png');
    });
  });
});
