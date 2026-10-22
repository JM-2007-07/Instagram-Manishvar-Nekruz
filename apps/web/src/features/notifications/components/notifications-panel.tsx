'use client';

import { Dialog } from 'radix-ui';
import { NotificationsList } from './notifications-list';

// Панель «Уведомления» выезжает слева, рядом со свёрнутым боковым меню (72 px), ширина 397 px.
export function NotificationsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-[72px] z-30 w-[397px] max-w-[calc(100vw-72px)] overflow-y-auto rounded-r-2xl border-r border-border bg-background shadow-[var(--shadow-strong)] outline-none"
        >
          <Dialog.Title className="px-6 pt-6 pb-2 text-24 font-bold">Уведомления</Dialog.Title>
          <NotificationsList />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
