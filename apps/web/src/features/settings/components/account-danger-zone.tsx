'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGetMeQuery } from '@/features/profile/api';
import { getApiError, showApiError } from '@/lib/api/errors';
import { useDeactivateAccountMutation, useDeleteAccountMutation } from '../api';
import { QueryState, Section, SettingsHeading, TextField } from './fields';

type Action = 'deactivate' | 'delete';

const TEXTS: Record<Action, { title: string; hint: string; button: string }> = {
  deactivate: {
    title: 'Временная деактивация',
    hint: 'Профиль будет скрыт, пока вы снова не войдёте в аккаунт.',
    button: 'Деактивировать аккаунт',
  },
  delete: {
    title: 'Удаление аккаунта',
    hint: 'Аккаунт будет удалён через 30 дней. Вход в течение этого срока отменит удаление.',
    button: 'Удалить аккаунт',
  },
};

export function AccountDangerZone() {
  const { data: me, isLoading, isError, refetch } = useGetMeQuery();
  const [deactivate, { isLoading: isDeactivating }] = useDeactivateAccountMutation();
  const [remove, { isLoading: isDeleting }] = useDeleteAccountMutation();
  const [action, setAction] = useState<Action | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!action) return;
    setError(undefined);
    const body = { password: me?.hasPassword ? password : undefined };
    try {
      if (action === 'deactivate') await deactivate(body).unwrap();
      else await remove(body).unwrap();
      // Сессия завершена на сервере — полная перезагрузка сбрасывает состояние.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/accounts/login/');
    } catch (err) {
      if (getApiError(err).status === 400) setError('Неверный пароль');
      else showApiError(err);
    }
  }

  return (
    <div>
      <SettingsHeading>Деактивация и удаление</SettingsHeading>
      <QueryState isLoading={isLoading} isError={isError} refetch={refetch}>
        {(['deactivate', 'delete'] as const).map((key) => (
          <Section key={key} title={TEXTS[key].title}>
            <p className="text-14 text-muted-foreground">{TEXTS[key].hint}</p>
            {action === key ? (
              <form
                onSubmit={handleConfirm}
                className="max-w-[400px] space-y-4"
                aria-label={`Подтверждение: ${TEXTS[key].title}`}
              >
                {me?.hasPassword && (
                  <TextField
                    label="Пароль для подтверждения"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={error}
                    required
                  />
                )}
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={isDeactivating || isDeleting || (!!me?.hasPassword && !password)}
                  >
                    Подтвердить
                  </Button>
                  <Button variant="secondary" onClick={() => setAction(null)}>
                    Отмена
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                variant={key === 'delete' ? 'destructive' : 'secondary'}
                onClick={() => {
                  setAction(key);
                  setPassword('');
                  setError(undefined);
                }}
              >
                {TEXTS[key].button}
              </Button>
            )}
          </Section>
        ))}
      </QueryState>
    </div>
  );
}
