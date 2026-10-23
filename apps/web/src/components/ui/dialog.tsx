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
      className={cn(
        'fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Окно по центру экрана. showClose — «✕» в правом верхнем углу экрана (как в Instagram),
 * а не внутри окна. Размеры окна задаёт вызывающий через className.
 * Content radix растянут на весь экран, чтобы «✕» был внутри диалога (иначе radix скрывает его
 * от экранного диктора); клик по пустому месту вокруг окна закрывает его, как клик по затемнению.
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
      <DialogPrimitive.Content
        className="group/dialog fixed inset-0 z-50 flex items-center justify-center outline-none"
        {...props}
      >
        <DialogPrimitive.Close asChild>
          <div aria-hidden="true" className="absolute inset-0" />
        </DialogPrimitive.Close>
        {showClose && (
          <DialogPrimitive.Close
            aria-label="Закрыть"
            className="absolute top-3 right-3 z-10 flex size-10 items-center justify-center text-white outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-6" />
          </DialogPrimitive.Close>
        )}
        <div
          className={cn(
            // Окно появляется с лёгким увеличением (как у Instagram), закрывается быстрее (DESIGN_SYSTEM §5).
            'relative max-h-[calc(100vh-40px)] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl bg-background-elevated text-foreground group-data-[state=open]/dialog:animate-in group-data-[state=open]/dialog:fade-in-0 group-data-[state=open]/dialog:zoom-in-[0.97] group-data-[state=open]/dialog:duration-200 group-data-[state=closed]/dialog:animate-out group-data-[state=closed]/dialog:fade-out-0 group-data-[state=closed]/dialog:zoom-out-[0.97] group-data-[state=closed]/dialog:duration-150',
            className,
          )}
        >
          {children}
        </div>
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
