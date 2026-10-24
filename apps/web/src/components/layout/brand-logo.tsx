/* eslint-disable @next/next/no-img-element -- файлы бренда из public/brand, оптимизация не нужна */
import { APP_NAME, BRAND_LOGO_URL, BRAND_MARK_URL } from '@/lib/config';
import { cn } from '@/lib/utils';

// Логотип проекта (ADR 0012, «Изменение 2026-10-23»).
// full — логотип: файл public/brand/logo.* или название рукописным шрифтом (Grand Hotel, DESIGN_SYSTEM §3.1);
// mark — знак для узкого меню и заставки: файл public/brand/mark.* (скругление 22 %, как у иконки приложения)
// или первая буква в круге.
// glyph — векторный контурный знак для бокового меню: рисуется currentColor, как остальные значки меню,
// поэтому сам меняет цвет в тёмной теме и не выглядит «фотографией» рядом с линейными иконками.
export function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('size-6', className)}
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BrandLogo({
  className,
  variant = 'full',
}: {
  className?: string;
  variant?: 'full' | 'mark';
}) {
  if (variant === 'mark') {
    if (BRAND_MARK_URL) {
      return (
        <img
          src={BRAND_MARK_URL}
          alt=""
          aria-hidden="true"
          className={cn('size-6 rounded-[22%] object-cover', className)}
        />
      );
    }
    return (
      <span
        aria-hidden="true"
        className={cn(
          'flex size-8 items-center justify-center rounded-full bg-primary text-16 font-bold text-primary-foreground',
          className,
        )}
      >
        {APP_NAME.charAt(0)}
      </span>
    );
  }
  if (BRAND_LOGO_URL) {
    // Высота логотипа в меню Instagram — 29 px 📝; логотип чёрный на прозрачном — в тёмной теме инвертируем.
    return (
      <img
        src={BRAND_LOGO_URL}
        alt={APP_NAME}
        className={cn('h-[29px] w-auto dark:invert', className)}
      />
    );
  }
  return (
    <span className={cn('font-wordmark text-30 leading-none text-foreground', className)}>
      {APP_NAME}
    </span>
  );
}
