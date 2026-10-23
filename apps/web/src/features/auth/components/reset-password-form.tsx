'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useResetPasswordMutation } from '../api';
import { authErrorText } from '../auth-error';
import { PASSWORD_MIN } from '../validation';
import { AuthHeading, AuthPage, FormError, authButton } from './auth-card';
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
      <AuthHeading
        title="Создайте надёжный пароль"
        description={`Пароль должен содержать не менее ${PASSWORD_MIN} символов.`}
      />
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
        <button
          type="submit"
          className={cn(authButton.primary, 'mt-3')}
          disabled={!isReady || isLoading}
        >
          Сохранить пароль
        </button>
        <FormError>{error}</FormError>
        <Link href="/accounts/password/reset/" className={authButton.secondary}>
          Запросить ссылку ещё раз
        </Link>
      </form>
    </AuthPage>
  );
}
