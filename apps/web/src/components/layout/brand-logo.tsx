import { APP_NAME } from '@/lib/config';
import { cn } from '@/lib/utils';

// Текстовый логотип проекта (ADR 0012: свой бренд, без знаков и шрифта Instagram).
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn('text-24 font-bold tracking-tight text-foreground', className)}>
      {APP_NAME}
    </span>
  );
}
