'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { showApiError } from '@/lib/api/errors';
import { useCompleteOAuthMutation } from '../api';
import { useFieldErrors } from '../use-field-errors';
import { isUserNameFormatValid, toBirthday } from '../validation';
import { AuthCard, AuthPage } from './auth-card';
import { BirthdayFields } from './birthday-fields';
import { TextField } from './text-field';

// Завершение соцвхода: имя пользователя и дата рождения.
export function OAuthCompleteForm() {
  const router = useRouter();
  const [complete, { isLoading }] = useCompleteOAuthMutation();
  const form = useFieldErrors();
  const [userName, setUserName] = useState('');
  const [birth, setBirth] = useState({ year: '', month: '', day: '' });

  const birthday = toBirthday(birth.year, birth.month, birth.day);
  const isReady = isUserNameFormatValid(userName) && birthday !== '';

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isReady || isLoading) return;
    form.clear();
    try {
      await complete({ userName, birthday }).unwrap();
      router.replace('/');
    } catch (e) {
      if ((e as { status?: number }).status === 409) {
        form.setError('userName', { message: 'Это имя пользователя уже занято' });
        return;
      }
      showApiError(e, form);
    }
  }

  return (
    <AuthPage>
      <AuthCard
        title="Почти готово"
        description="Выберите имя пользователя и укажите дату рождения."
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <TextField
            label="Имя пользователя"
            name="userName"
            autoCapitalize="none"
            maxLength={30}
            value={userName}
            error={form.errors.userName}
            onChange={(e) => setUserName(e.target.value.toLowerCase())}
          />
          <BirthdayFields value={birth} onChange={setBirth} error={form.errors.birthday} />
          <Button type="submit" className="h-9 w-full" disabled={!isReady || isLoading}>
            Продолжить
          </Button>
        </form>
      </AuthCard>
    </AuthPage>
  );
}
