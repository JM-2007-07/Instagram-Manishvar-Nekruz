'use client';

import { Dialog } from 'radix-ui';
import { SearchContent } from './search-content';

// Панель «Поиск» в том же виде, что панель уведомлений Instagram (2026): 460 px от левого края.
// Анимация — --ease-move (DESIGN_SYSTEM §5); Esc и щелчок вне панели закрывают её.
export function SearchPanel({
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
          className="fixed inset-y-0 left-0 z-50 flex w-[460px] max-w-full flex-col overflow-y-auto border-r-[0.8px] border-separator bg-background px-4 pt-6 pb-2 duration-300 ease-(--ease-move) outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left"
        >
          <Dialog.Title className="px-4 pt-1.5 pb-6 text-24 leading-[30px] font-bold">
            Поисковый запрос
          </Dialog.Title>
          <SearchContent onNavigate={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
