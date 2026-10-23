import { APP_NAME, BRAND_LOGO_URL, BRAND_MARK_URL } from '@/lib/config';
import { cn } from '@/lib/utils';

// Логотип проекта. full — логотип (файл public/brand/logo.* или название текстом);
// mark — знак для узкого меню и заставки (файл public/brand/mark.* или первая буква в круге).
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
        // eslint-disable-next-line @next/next/no-img-element
        <img src={BRAND_MARK_URL} alt="" aria-hidden="true" className={cn('size-6', className)} />
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
    // Высота логотипа в меню Instagram — 29 px 📝; в тёмной теме svg с fill="currentColor" не перекрашивается,
    // поэтому для тёмной темы инвертируем (логотип — чёрный на прозрачном).
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={BRAND_LOGO_URL}
        alt={APP_NAME}
        className={cn('h-[29px] w-auto dark:invert', className)}
      />
    );
  }
  return (
    <span className={cn('text-24 font-bold tracking-tight text-foreground', className)}>
      {APP_NAME}
    </span>
  );
}
