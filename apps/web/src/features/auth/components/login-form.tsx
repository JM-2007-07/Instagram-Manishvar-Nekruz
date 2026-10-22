'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getApiError } from '@/lib/api/errors';
import { useLoginMutation, useLoginTwoFactorMutation } from '../api';
import { authErrorText } from '../auth-error';
import { isLoginFormValid } from '../validation';
import { AuthCard, AuthPage, AuthSwitchCard, FormError, PhonePreview } from './auth-card';
import { OAuthButtons } from './oauth-buttons';
import { TextField } from './text-field';
import { VerifyCodeForm } from './verify-code-form';

type Step = 'credentials' | 'twoFactor' | 'verify';

export function LoginForm({ oauthFailed = false }: { oauthFailed?: boolean }) {
  const router = useRouter();
  const [login, { isLoading }] = useLoginMutation();
  const [loginTwoFactor, { isLoading: isCheckingCode }] = useLoginTwoFactorMutation();

  const [step, setStep] = useState<Step>('credentials');
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(
    oauthFailed ? 'Не удалось войти через внешний сервис' : null,
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isLoginFormValid(identity, password) || isLoading) return;
    setError(null);
    try {
      const result = await login({ login: identity.trim(), password }).unwrap();
      if ('twoFactorRequired' in result) {
        setChallengeId(result.challengeId);
        setStep('twoFactor');
      } else {
        router.replace('/');
      }
    } catch (e) {
      if (getApiError(e).code === 'EMAIL_NOT_VERIFIED' && identity.includes('@')) {
        setStep('verify'); // экран кода с повторной отправкой
        return;
      }
      setError(authErrorText(e));
    }
  }

  async function onSubmitCode(event: React.FormEvent) {
    event.preventDefault();
    if (code.trim().length === 0 || isCheckingCode) return;
    setError(null);
    try {
      await loginTwoFactor({ challengeId, code: code.trim() }).unwrap();
      router.replace('/');
    } catch (e) {
      setError(authErrorText(e));
    }
  }

  if (step === 'verify') {
    return <VerifyCodeForm email={identity.trim().toLowerCase()} />;
  }

  if (step === 'twoFactor') {
    return (
      <AuthPage>
        <AuthCard
          title="Двухфакторная аутентификация"
          description="Введите код из приложения-аутентификатора или резервный код."
        >
          <form onSubmit={onSubmitCode} className="flex flex-col gap-3" noValidate>
            <TextField
              label="Код"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button
              type="submit"
              className="h-9 w-full"
              disabled={code.trim().length === 0 || isCheckingCode}
            >
              Подтвердить
            </Button>
            <FormError>{error}</FormError>
          </form>
          <Button variant="link" onClick={() => setStep('credentials')}>
            Назад
          </Button>
        </AuthCard>
      </AuthPage>
    );
  }

  return (
    <AuthPage aside={<PhonePreview />}>
      <AuthCard>
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <TextField
            label="Имя пользователя или электронный адрес"
            name="login"
            autoComplete="username"
            autoCapitalize="none"
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
          />
          <TextField
            label="Пароль"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="submit"
            className="h-9 w-full"
            disabled={!isLoginFormValid(identity, password) || isLoading}
          >
            Войти
          </Button>
          <FormError>{error}</FormError>
        </form>
        <OAuthButtons />
        <Link
          href="/accounts/password/reset/"
          className="text-center text-12 text-link-profile hover:underline"
        >
          Забыли пароль?
        </Link>
      </AuthCard>
      <AuthSwitchCard
        text="Нет аккаунта?"
        linkText="Зарегистрироваться"
        href="/accounts/emailsignup/"
      />
    </AuthPage>
  );
}
