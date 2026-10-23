'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { showApiError } from '@/lib/api/errors';
import { useCompleteOAuthMutation } from '../api';
import { useFieldErrors } from '../use-field-errors';
import { isUserNameFormatValid, toBirthday } from '../validation';
import { AuthHeading, AuthPage, AuthSection, authButton } from './auth-card';
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
      <AuthHeading
        title="Почти готово"
        description="Выберите имя пользователя и укажите дату рождения."
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        <AuthSection title="Имя пользователя">
          <TextField
            label="Имя пользователя"
            name="userName"
            autoCapitalize="none"
            maxLength={30}
            value={userName}
            error={form.errors.userName}
            onChange={(e) => setUserName(e.target.value.toLowerCase())}
          />
        </AuthSection>
        <AuthSection title="Дата рождения">
          <BirthdayFields value={birth} onChange={setBirth} error={form.errors.birthday} />
        </AuthSection>
        <button type="submit" className={authButton.primary} disabled={!isReady || isLoading}>
          Продолжить
        </button>
      </form>
    </AuthPage>
  );
}
