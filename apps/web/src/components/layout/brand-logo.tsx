/* eslint-disable @next/next/no-img-element -- локальные файлы бренда, оптимизация не нужна */
import { APP_NAME, BRAND_MARK_SRC, BRAND_WORDMARK_SRC } from '@/lib/config';
import { cn } from '@/lib/utils';

// Логотип проекта (ADR 0012: свой бренд, без знаков и шрифта Instagram).
// full — название; mark — знак для узкого меню: первая буква в круге (📝 пока Q31 открыт).
// Если в .env.local указаны локальные картинки (NEXT_PUBLIC_BRAND_MARK / _WORDMARK), показываем их.
export function BrandLogo({
  className,
  variant = 'full',
}: {
  className?: string;
  variant?: 'full' | 'mark';
}) {
  if (variant === 'mark') {
    if (BRAND_MARK_SRC) {
      return (
        <img
          src={BRAND_MARK_SRC}
          alt=""
          aria-hidden="true"
          className={cn('size-8 rounded-[22%] object-cover', className)}
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
  if (BRAND_WORDMARK_SRC) {
    return (
      <img
        src={BRAND_WORDMARK_SRC}
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
