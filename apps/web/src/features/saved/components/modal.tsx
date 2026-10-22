'use client';

import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';

// Центрированное модальное окно функции «Сохранённое»: Esc и возврат фокуса даёт radix.
export function Modal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/65" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[80vh] w-[calc(100vw-32px)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-background-elevated text-foreground shadow-[var(--shadow-strong)] outline-none"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="text-16 font-semibold">{title}</Dialog.Title>
            <Dialog.Close aria-label="Закрыть" className="rounded-lg p-1 hover:bg-hover-overlay">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
