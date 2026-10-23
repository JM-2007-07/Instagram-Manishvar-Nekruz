'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForgotPasswordMutation } from '../api';
import { authErrorText } from '../auth-error';
import { AuthHeading, AuthPage, FormError, authButton } from './auth-card';
import { TextField } from './text-field';

export function ForgotPasswordForm() {
  const [forgot, { isLoading }] = useForgotPasswordMutation();
  const [identity, setIdentity] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (identity.trim() === '' || isLoading) return;
    setError(null);
    try {
      await forgot({ login: identity.trim() }).unwrap();
      setSent(true);
    } catch (e) {
      setError(authErrorText(e));
    }
  }

  if (sent) {
    return (
      <AuthPage>
        <MailCheck className="mt-6 size-12 text-auth-text" aria-hidden="true" />
        <AuthHeading
          title="Проверьте почту"
          description="Если аккаунт существует, мы отправили ссылку для сброса пароля."
        />
        <Link href="/accounts/login/" className={authButton.primary}>
          Вернуться ко входу
        </Link>
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <AuthHeading
        title="Найдите свой аккаунт"
        description="Введите имя пользователя или электронный адрес, и мы отправим ссылку для восстановления доступа."
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <TextField
          label="Имя пользователя или электронный адрес"
          name="login"
          autoComplete="username"
          autoCapitalize="none"
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
        />
        <button
          type="submit"
          className={cn(authButton.primary, 'mt-3')}
          disabled={identity.trim() === '' || isLoading}
        >
          Продолжить
        </button>
        <FormError>{error}</FormError>
        <Link href="/accounts/login/" className={authButton.secondary}>
          Вернуться ко входу
        </Link>
      </form>
    </AuthPage>
  );
}
