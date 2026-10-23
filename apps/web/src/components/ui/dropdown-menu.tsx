'use client';

import * as React from 'react';
import { DropdownMenu as Menu } from 'radix-ui';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Тонкая обёртка над radix DropdownMenu на наших токенах. Esc и стрелки даёт radix.
export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuRadioGroup = Menu.RadioGroup;
export const DropdownMenuSub = Menu.Sub;

const itemClass =
  'flex cursor-default items-center gap-3 rounded-lg px-4 py-3 text-14 outline-none select-none data-[highlighted]:bg-hover-overlay data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

// Панель: не выше доступного места на экране (длинное меню прокручивается), появляется от кнопки
// (transform-origin radix) — 150 мс, гаснет за 100 мс (DESIGN_SYSTEM §5).
const panelClass =
  'z-[60] max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto rounded-2xl bg-popover p-2 text-popover-foreground shadow-(--shadow-strong) origin-(--radix-dropdown-menu-content-transform-origin) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-100 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1';

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  collisionPadding = 8,
  ...props
}: React.ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(panelClass, 'min-w-60', className)}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof Menu.Item>) {
  return <Menu.Item className={cn(itemClass, className)} {...props} />;
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem className={cn(itemClass, 'justify-between', className)} {...props}>
      {children}
      <Menu.ItemIndicator>
        <Check className="size-4" />
      </Menu.ItemIndicator>
    </Menu.RadioItem>
  );
}

export function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Menu.SubTrigger>) {
  return (
    <Menu.SubTrigger className={cn(itemClass, className)} {...props}>
      {children}
      <ChevronRight className="ml-auto size-4" />
    </Menu.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof Menu.SubContent>) {
  return (
    <Menu.Portal>
      <Menu.SubContent
        collisionPadding={8}
        className={cn(panelClass, 'min-w-48', className)}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn('my-2 h-px bg-separator', className)} {...props} />;
}
