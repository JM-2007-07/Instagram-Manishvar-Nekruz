'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useResendCodeMutation, useVerifyEmailMutation } from '../api';
import { authErrorText } from '../auth-error';
import { AuthCard, AuthPage, FormError } from './auth-card';
import { TextField } from './text-field';

// Экран «Введите код подтверждения» (6 цифр) с повторной отправкой.
export function VerifyCodeForm({ email }: { email: string }) {
  const router = useRouter();
  const [verifyEmail, { isLoading }] = useVerifyEmailMutation();
  const [resendCode, { isLoading: isResending }] = useResendCodeMutation();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isValid = /^\d{6}$/.test(code);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid || isLoading) return;
    setError(null);
    setInfo(null);
    try {
      await verifyEmail({ email, code }).unwrap();
      router.replace('/');
    } catch (e) {
      setError(authErrorText(e));
    }
  }

  async function onResend() {
    setError(null);
    setInfo(null);
    try {
      await resendCode({ email }).unwrap();
      setInfo('Мы отправили новый код');
    } catch (e) {
      setError(authErrorText(e));
    }
  }

  return (
    <AuthPage>
      <AuthCard
        title="Введите код подтверждения"
        description={`Мы отправили 6-значный код на ${email}.`}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <TextField
            label="Код подтверждения"
            name="code"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <Button type="submit" className="h-9 w-full" disabled={!isValid || isLoading}>
            Подтвердить
          </Button>
          <FormError>{error}</FormError>
          {info && (
            <p role="status" className="text-center text-14 text-success">
              {info}
            </p>
          )}
        </form>
        <Button variant="link" onClick={onResend} disabled={isResending}>
          Отправить код ещё раз
        </Button>
      </AuthCard>
    </AuthPage>
  );
}
