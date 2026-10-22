'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { parseTheme, setTheme, type Theme } from '@/lib/theme';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'system', label: 'Как в системе' },
];

// Меню «Ещё». «Ваши действия», переключение аккаунтов и «Сообщить о проблеме» — вне объёма.
export function MoreMenu({
  userName,
  theme,
  triggerClassName,
}: {
  userName: string;
  theme: Theme;
  triggerClassName?: string;
}) {
  const [current, setCurrent] = useState<Theme>(theme);

  function changeTheme(value: string) {
    const next = parseTheme(value);
    setCurrent(next);
    setTheme(next);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Ещё" className={triggerClassName}>
        <Menu className="size-6 shrink-0" />
        <span className="whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
          Ещё
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        <DropdownMenuItem asChild>
          <Link href="/accounts/edit/">Настройки</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${userName}/saved/`}>Сохранённое</Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Переключить режим</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={current} onValueChange={changeTheme}>
              {THEMES.map((t) => (
                <DropdownMenuRadioItem key={t.value} value={t.value}>
                  {t.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        {/* TODO(T1.A2, Студент A): POST /auth/logout через features/auth/api.ts */}
        <DropdownMenuItem disabled>Выйти</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
