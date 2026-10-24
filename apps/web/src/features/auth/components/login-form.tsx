'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/layout/brand-logo';
import { APP_NAME } from '@/lib/config';
import { cn } from '@/lib/utils';
import { getApiError } from '@/lib/api/errors';
import { useLoginMutation, useLoginTwoFactorMutation } from '../api';
import { authErrorText } from '../auth-error';
import { isLoginFormValid } from '../validation';
import { AuthHeading, AuthHeroPage, AuthPage, FormError, authButton } from './auth-card';
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
        <AuthHeading
          title="Двухфакторная аутентификация"
          description="Введите код из приложения-аутентификатора или резервный код."
        />
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
          <button
            type="submit"
            className={cn(authButton.primary, 'mt-3')}
            disabled={code.trim().length === 0 || isCheckingCode}
          >
            Подтвердить
          </button>
          <FormError>{error}</FormError>
          <button
            type="button"
            className={authButton.secondary}
            onClick={() => setStep('credentials')}
          >
            Назад
          </button>
        </form>
      </AuthPage>
    );
  }

  return (
    <AuthHeroPage>
      {/* min-h 484 px — высота блока формы у instagram.com: форма стоит на той же высоте экрана */}
      <div className="flex w-full flex-1 flex-col min-[640px]:max-w-[546px] min-[640px]:flex-none min-[1064px]:min-h-[484px]">
        {/* Телефон: знак и надпись по центру (на компьютере знак — в левой колонке, надпись не нужна) */}
        <div className="flex flex-col items-center gap-5 pt-[96px] pb-[56px] min-[640px]:hidden">
          <BrandLogo variant="mark" className="size-[60px] text-30" />
          <BrandLogo className="text-[42px] text-auth-text" />
        </div>
        <h1 className="mb-6 hidden text-17 font-semibold text-auth-text min-[640px]:block">
          Войти в {APP_NAME}
        </h1>
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
          <button
            type="submit"
            className={cn(authButton.primary, 'mt-3')}
            disabled={!isLoginFormValid(identity, password) || isLoading}
          >
            Войти
          </button>
          <FormError>{error}</FormError>
        </form>
        <Link href="/accounts/password/reset/" className={cn(authButton.link, 'mt-3')}>
          Забыли пароль?
        </Link>
        <div className="mt-auto flex flex-col gap-3 pt-[52px] pb-[34px] min-[640px]:mt-0 min-[640px]:pb-0">
          <OAuthButtons />
          <Link href="/accounts/emailsignup/" className={authButton.outline}>
            Создать новый аккаунт
          </Link>
        </div>
      </div>
    </AuthHeroPage>
  );
}
