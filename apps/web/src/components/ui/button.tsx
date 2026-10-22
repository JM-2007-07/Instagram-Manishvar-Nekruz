import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Основная кнопка: высота 32 px, отступы 7/16, скругление 8 px, текст 14/18 вес 600 (DESIGN_SYSTEM §4).
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-14 font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-button-primary-hover',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-button-secondary-hover',
        ghost: 'text-foreground hover:bg-hover-overlay',
        link: 'text-button-borderless hover:text-button-borderless-hover',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
      },
      size: {
        default: 'h-8 px-4 py-[7px]',
        sm: 'h-7 px-3',
        lg: 'h-11 px-6',
        icon: 'size-8',
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
