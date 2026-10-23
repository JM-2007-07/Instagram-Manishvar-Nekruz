'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
// Нажатие меняет вид сразу (оптимистично); при ошибке возвращается прежнее состояние и показывается тост.
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

  if (variant === 'link') {
    return (
      <button
        type="button"
        disabled={following || unfollowing}
        onClick={handleClick}
        className={cn(
          'text-12 font-semibold outline-none focus-visible:underline',
          status === 'NONE'
            ? 'text-button-borderless hover:text-button-borderless-hover'
            : 'text-foreground hover:opacity-70',
          className,
        )}
      >
        {LABELS[status]}
      </button>
    );
  }

  return (
    <Button
      variant={status === 'NONE' ? 'default' : 'secondary'}
      disabled={following || unfollowing}
      onClick={handleClick}
      className={className}
    >
      {LABELS[status]}
    </Button>
  );
}
