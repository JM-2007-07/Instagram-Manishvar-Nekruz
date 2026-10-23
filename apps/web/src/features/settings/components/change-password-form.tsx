'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useGetMeQuery } from '@/features/profile/api';
import { getApiError, showApiError } from '@/lib/api/errors';
import { useChangePasswordMutation } from '../api';
import { QueryState, SettingsHeading, TextField } from './fields';

export function ChangePasswordForm() {
  const { data: me, isLoading: isMeLoading, isError, refetch } = useGetMeQuery();
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== repeat) {
      setErrors({ repeat: 'Пароли не совпадают' });
      return;
    }
    setErrors({});
    try {
      await changePassword({
        currentPassword: me?.hasPassword ? current : undefined,
        newPassword: next,
      }).unwrap();
      setCurrent('');
      setNext('');
      setRepeat('');
      toast.success('Пароль изменён');
    } catch (error) {
      const apiError = getApiError(error);
      if (apiError.code === 'VALIDATION_ERROR' && apiError.details?.length) {
        setErrors(Object.fromEntries(apiError.details.map((d) => [d.field, d.message])));
      } else if (apiError.code === 'INVALID_CREDENTIALS') {
        setErrors({ currentPassword: 'Неверный текущий пароль' });
      } else showApiError(error);
    }
  }

  return (
    <div>
      <SettingsHeading>Смена пароля</SettingsHeading>
      <QueryState isLoading={isMeLoading} isError={isError} refetch={refetch}>
        <form onSubmit={handleSubmit} className="max-w-[400px] space-y-4">
          {me?.hasPassword && (
            <TextField
              label="Текущий пароль"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              error={errors.currentPassword}
              required
            />
          )}
          <TextField
            label="Новый пароль"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            error={errors.newPassword}
            required
          />
          <TextField
            label="Повторите новый пароль"
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            error={errors.repeat}
            required
          />
          <Button type="submit" disabled={isLoading || !next || !repeat}>
            Сменить пароль
          </Button>
        </form>
      </QueryState>
    </div>
  );
}
