'use client';

import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Тонкая обёртка над radix Dialog на наших токенах (DESIGN_SYSTEM §4.5).
// Esc, фокус внутри окна и блокировку прокрутки даёт radix.
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

// Затемнение страницы за окном 📝.
export function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 z-50 bg-overlay', className)}
      {...props}
    />
  );
}

/**
 * Окно по центру экрана. showClose — «✕» в правом верхнем углу экрана (как в Instagram),
 * а не внутри окна. Размеры окна задаёт вызывающий через className.
 */
export function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      {showClose && (
        <DialogPrimitive.Close
          aria-label="Закрыть"
          className="fixed top-3 right-3 z-[60] flex size-10 items-center justify-center text-white outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-6" />
        </DialogPrimitive.Close>
      )}
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 max-h-[calc(100vh-40px)] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-background-elevated text-foreground outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// Заголовок окна: 42 px, 16/24 вес 600, разделитель снизу (DESIGN_SYSTEM §4.5).
export function DialogHeader({ className, children }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex h-[42px] items-center justify-center border-b border-border px-4 text-16 font-semibold',
        className,
      )}
    >
      {children}
    </div>
  );
}
