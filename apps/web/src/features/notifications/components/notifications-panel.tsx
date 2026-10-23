'use client';

import { Dialog } from 'radix-ui';
import { NotificationsList } from './notifications-list';

// Панель «Уведомления» как у Instagram (2026): 460 px от левого края поверх меню,
// рамка справа 0.8 px, без тени; заголовок 24/30 жирный.
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
          className="fixed inset-y-0 left-0 z-50 w-[460px] max-w-full overflow-y-auto border-r-[0.8px] border-separator bg-background px-4 pt-6 pb-2 outline-none duration-300 ease-(--ease-move) data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left"
        >
          <Dialog.Title className="px-6 pt-1.5 pb-3 text-24 leading-[30px] font-bold">
            Уведомления
          </Dialog.Title>
          <NotificationsList />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
