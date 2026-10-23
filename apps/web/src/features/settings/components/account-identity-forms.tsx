'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  useChangeUserNameMutation,
  useRequestEmailChangeMutation,
  useVerifyEmailChangeMutation,
} from '@/features/profile/api';
import { getApiError, showApiError } from '@/lib/api/errors';
import type { Me } from '@/lib/api/types';
import { Section, TextField } from './fields';

// Имя пользователя и email (смена email — с кодом из письма).
export function AccountIdentityForms({ me }: { me: Me }) {
  const [changeUserName, { isLoading: isNameLoading }] = useChangeUserNameMutation();
  const [requestEmail, { isLoading: isRequesting }] = useRequestEmailChangeMutation();
  const [verifyEmail, { isLoading: isVerifying }] = useVerifyEmailChangeMutation();

  const [userName, setUserName] = useState(me.userName);
  const [nameError, setNameError] = useState<string>();
  const [email, setEmail] = useState(me.email);
  const [password, setPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();

  async function handleName(e: React.FormEvent) {
    e.preventDefault();
    setNameError(undefined);
    try {
      await changeUserName(userName.trim()).unwrap();
      toast.success('Имя пользователя изменено');
    } catch (error) {
      const apiError = getApiError(error);
      if (apiError.code === 'CONFLICT') setNameError('Это имя пользователя уже занято');
      else if (apiError.code === 'VALIDATION_ERROR') {
        setNameError(apiError.details?.[0]?.message ?? 'Недопустимое имя пользователя');
      } else showApiError(error);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    try {
      await requestEmail({ email, password: me.hasPassword ? password : undefined }).unwrap();
      setCodeSent(true);
      toast.success('Код отправлен на новый email');
    } catch (error) {
      showApiError(error);
    }
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    setCodeError(undefined);
    try {
      await verifyEmail(code.trim()).unwrap();
      setCodeSent(false);
      setCode('');
      setPassword('');
      toast.success('Email изменён');
    } catch (error) {
      const apiError = getApiError(error);
      if (apiError.status === 400) setCodeError('Неверный или просроченный код');
      else showApiError(error);
    }
  }

  return (
    <>
      <Section title="Имя пользователя">
        <form onSubmit={handleName} className="space-y-4">
          <TextField
            label="Имя пользователя"
            value={userName}
            onChange={(e) => setUserName(e.target.value.toLowerCase())}
            maxLength={30}
            autoCapitalize="none"
            error={nameError}
          />
          <Button
            type="submit"
            disabled={isNameLoading || !userName.trim() || userName === me.userName}
          >
            Изменить имя пользователя
          </Button>
        </form>
      </Section>

      <Section title="Email">
        <form onSubmit={handleEmail} className="space-y-4">
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {me.hasPassword && (
            <TextField
              label="Пароль для подтверждения"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <Button type="submit" disabled={isRequesting || !email || email === me.email}>
            Отправить код
          </Button>
        </form>
        {codeSent && (
          <form onSubmit={handleCode} className="space-y-4">
            <TextField
              label="Код из письма"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              error={codeError}
            />
            <Button type="submit" disabled={isVerifying || !code.trim()}>
              Подтвердить email
            </Button>
          </form>
        )}
      </Section>
    </>
  );
}
