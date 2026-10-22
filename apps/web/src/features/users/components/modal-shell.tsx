'use client';

import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import { DESIGN } from '@/lib/design';

// Модальное окно списка: заголовок 42 px с разделителем и «✕», затемнение страницы, Esc закрывает (DESIGN_SYSTEM §4.5).
export function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/65" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(400px,80vh)] w-[calc(100vw-32px)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-background-elevated shadow-[var(--shadow-strong)] outline-none"
        >
          <div
            className="relative flex shrink-0 items-center justify-center border-b border-separator"
            style={{ height: DESIGN.modalHeaderHeight }}
          >
            <Dialog.Title className="text-16 font-semibold">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Закрыть"
              className="absolute right-2 flex size-8 items-center justify-center rounded-lg outline-none hover:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
