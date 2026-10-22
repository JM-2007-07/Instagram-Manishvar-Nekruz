'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useForgotPasswordMutation } from '../api';
import { authErrorText } from '../auth-error';
import { AuthCard, AuthPage, AuthSwitchCard, FormError } from './auth-card';
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
        <AuthCard title="Проверьте почту">
          <MailCheck className="mx-auto size-12 text-muted-foreground" aria-hidden="true" />
          <p className="text-center text-14 text-muted-foreground">
            Если аккаунт существует, мы отправили ссылку для сброса пароля.
          </p>
          <Link
            href="/accounts/login/"
            className="text-center text-14 font-semibold text-button-borderless hover:text-button-borderless-hover"
          >
            Вернуться ко входу
          </Link>
        </AuthCard>
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <AuthCard
        title="Проблемы со входом?"
        description="Введите имя пользователя или электронный адрес, и мы отправим ссылку для восстановления доступа."
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <TextField
            label="Имя пользователя или электронный адрес"
            name="login"
            autoComplete="username"
            autoCapitalize="none"
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
          />
          <Button
            type="submit"
            className="h-9 w-full"
            disabled={identity.trim() === '' || isLoading}
          >
            Отправить ссылку
          </Button>
          <FormError>{error}</FormError>
        </form>
      </AuthCard>
      <AuthSwitchCard text="Вспомнили пароль?" linkText="Вход" href="/accounts/login/" />
    </AuthPage>
  );
}
