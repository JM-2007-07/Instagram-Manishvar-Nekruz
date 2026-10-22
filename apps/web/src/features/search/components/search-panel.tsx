'use client';

import { Dialog } from 'radix-ui';
import { SearchContent } from './search-content';

// Панель «Поиск» выезжает слева рядом со свёрнутым боковым меню (72 px), ширина 397 px.
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
          className="fixed inset-y-0 left-[72px] z-30 flex w-[397px] max-w-[calc(100vw-72px)] flex-col overflow-y-auto rounded-r-2xl border-r border-border bg-background shadow-[var(--shadow-strong)] duration-300 ease-[var(--ease-move)] outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left"
        >
          <Dialog.Title className="px-6 pt-6 pb-4 text-24 font-bold">Поисковый запрос</Dialog.Title>
          <SearchContent onNavigate={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
