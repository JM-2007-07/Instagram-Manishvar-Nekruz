'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { showApiError } from '@/lib/api/errors';
import type { FollowStatus } from '@/lib/api/types';
import { useFollowUserMutation, useUnfollowUserMutation } from '../api';

const LABELS: Record<FollowStatus, string> = {
  NONE: 'Подписаться',
  FOLLOWING: 'Подписки',
  REQUESTED: 'Запрос отправлен',
};

// Кнопка подписки: NONE → «Подписаться», FOLLOWING → «Подписки», REQUESTED → «Запрос отправлен».
// «Подписки» открывает меню «Отменить подписку». Нажатие меняет вид сразу (оптимистично); при ошибке возвращается прежнее состояние и показывается тост.
// Для закрытого аккаунта ответ сервера (PENDING) уточняет итоговое состояние.
export function FollowButton({
  userId,
  followStatus = 'NONE',
  isPrivate = false,
  variant = 'button',
  className,
}: {
  userId: string;
  followStatus?: FollowStatus; // не знаем статус (рекомендации) — начинаем с «Подписаться»
  isPrivate?: boolean;
  variant?: 'button' | 'link'; // link — текстовая кнопка 12/16 вес 600, как в рекомендациях
  className?: string;
}) {
  const [follow, { isLoading: following }] = useFollowUserMutation();
  const [unfollow, { isLoading: unfollowing }] = useUnfollowUserMutation();
  // Локальное состояние поверх пропса; перестаёт действовать, когда сервер прислал новое значение пропса.
  const [local, setLocal] = useState<{ base: FollowStatus; value: FollowStatus } | null>(null);
  const status = local && local.base === followStatus ? local.value : followStatus;

  async function handleClick() {
    const previous = status;
    try {
      if (previous === 'NONE') {
        setLocal({ base: followStatus, value: isPrivate ? 'REQUESTED' : 'FOLLOWING' });
        const result = await follow(userId).unwrap();
        setLocal({
          base: followStatus,
          value: result.status === 'PENDING' ? 'REQUESTED' : 'FOLLOWING',
        });
      } else {
        setLocal({ base: followStatus, value: 'NONE' });
        await unfollow(userId).unwrap();
      }
    } catch (error) {
      setLocal({ base: followStatus, value: previous });
      showApiError(error);
    }
  }

  const busy = following || unfollowing;
  const linkClass = cn(
    'text-12 font-semibold outline-none focus-visible:underline',
    status === 'NONE'
      ? 'text-button-borderless hover:text-button-borderless-hover'
      : 'text-foreground hover:opacity-70',
    className,
  );

  // «Подписаться» — сразу подписка. «Подписки» / «Запрос отправлен» — меню с отменой (как у Instagram),
  // чтобы случайный клик не отписывал.
  if (status === 'NONE') {
    return variant === 'link' ? (
      <button type="button" disabled={busy} onClick={handleClick} className={linkClass}>
        {LABELS[status]}
      </button>
    ) : (
      <Button variant="default" disabled={busy} onClick={handleClick} className={className}>
        {LABELS[status]}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={busy}>
        {variant === 'link' ? (
          <button type="button" className={linkClass}>
            {LABELS[status]}
          </button>
        ) : (
          <Button variant="secondary" className={cn('gap-1', className)}>
            {LABELS[status]}
            <ChevronDown className="size-4" aria-hidden />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem className="text-destructive" onSelect={() => void handleClick()}>
          {status === 'REQUESTED' ? 'Отменить запрос' : 'Отменить подписку'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
