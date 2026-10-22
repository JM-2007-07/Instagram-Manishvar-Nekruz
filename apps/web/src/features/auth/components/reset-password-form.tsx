'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useResetPasswordMutation } from '../api';
import { authErrorText } from '../auth-error';
import { PASSWORD_MIN } from '../validation';
import { AuthCard, AuthPage, FormError } from './auth-card';
import { TextField } from './text-field';

// Новый пароль по ссылке из письма (?token=...).
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [resetPassword, { isLoading }] = useResetPasswordMutation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm !== '' && confirm !== password;
  const isReady = password.length >= PASSWORD_MIN && password === confirm;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isReady || isLoading) return;
    setError(null);
    try {
      await resetPassword({ token, newPassword: password }).unwrap();
      toast.success('Пароль изменён. Войдите с новым паролем');
      router.replace('/accounts/login/');
    } catch (e) {
      setError(authErrorText(e));
    }
  }

  return (
    <AuthPage>
      <AuthCard title="Новый пароль" description={`Минимум ${PASSWORD_MIN} символов.`}>
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <TextField
            label="Новый пароль"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <TextField
            label="Повторите пароль"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirm}
            error={mismatch ? 'Пароли не совпадают' : undefined}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button type="submit" className="h-9 w-full" disabled={!isReady || isLoading}>
            Сохранить пароль
          </Button>
          <FormError>{error}</FormError>
        </form>
        <Link
          href="/accounts/password/reset/"
          className="text-center text-12 text-link-profile hover:underline"
        >
          Запросить ссылку ещё раз
        </Link>
      </AuthCard>
    </AuthPage>
  );
}
