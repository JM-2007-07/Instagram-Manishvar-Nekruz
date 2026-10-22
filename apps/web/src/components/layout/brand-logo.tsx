import { APP_NAME } from '@/lib/config';
import { cn } from '@/lib/utils';

// Логотип проекта (ADR 0012: свой бренд, без знаков и шрифта Instagram).
// full — название; mark — знак для узкого меню: первая буква в круге (📝 пока Q31 открыт).
export function BrandLogo({
  className,
  variant = 'full',
}: {
  className?: string;
  variant?: 'full' | 'mark';
}) {
  if (variant === 'mark') {
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
  return (
    <span className={cn('text-24 font-bold tracking-tight text-foreground', className)}>
      {APP_NAME}
    </span>
  );
}
