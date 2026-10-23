import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Основная кнопка: высота 32 px, отступы 7/16, скругление 8 px, текст 14/18 вес 600 (DESIGN_SYSTEM §4).
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-14 font-semibold transition-[color,background-color,opacity,transform] duration-100 ease-(--ease-hover) outline-none active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Отключённая основная кнопка — свой цвет из DESIGN_SYSTEM §2.2, а не прозрачность.
        default:
          'bg-primary text-primary-foreground hover:bg-button-primary-hover disabled:bg-button-primary-disabled disabled:opacity-100',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-button-secondary-hover',
        ghost: 'text-foreground hover:bg-hover-overlay',
        link: 'text-button-borderless hover:text-button-borderless-hover',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
      },
      size: {
        // Другие размеры добавим, когда они понадобятся экранам и будут в DESIGN_SYSTEM.
        default: 'h-8 px-4 py-[7px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export { Button, buttonVariants };
