'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showApiError } from '@/lib/api/errors';
import { useCheckUserNameQuery, useRegisterMutation } from '../api';
import { useFieldErrors } from '../use-field-errors';
import { PASSWORD_MIN, isEmailValid, isUserNameFormatValid, toBirthday } from '../validation';
import { AuthCard, AuthPage, AuthSwitchCard } from './auth-card';
import { BirthdayFields } from './birthday-fields';
import { OAuthButtons } from './oauth-buttons';
import { TextField } from './text-field';
import { UserNameSuggestions } from './user-name-suggestions';
import { VerifyCodeForm } from './verify-code-form';

// Имя проверяем через 400 мс после последнего нажатия клавиши.
function useDebounced(value: string, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function SignupForm() {
  const [register, { isLoading }] = useRegisterMutation();
  const form = useFieldErrors();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [birth, setBirth] = useState({ year: '', month: '', day: '' });
  const [sentTo, setSentTo] = useState<string | null>(null);

  const debouncedName = useDebounced(userName);
  const canCheckName = isUserNameFormatValid(debouncedName) && debouncedName === userName;
  const availability = useCheckUserNameQuery(debouncedName, { skip: !canCheckName });
  const isTaken = canCheckName && availability.data?.available === false;

  const birthday = toBirthday(birth.year, birth.month, birth.day);
  const isReady =
    isEmailValid(email) &&
    fullName.trim().length > 0 &&
    isUserNameFormatValid(userName) &&
    password.length >= PASSWORD_MIN &&
    birthday !== '' &&
    !isTaken;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isReady || isLoading) return;
    form.clear();
    try {
      const result = await register({
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        userName,
        password,
        birthday,
      }).unwrap();
      setSentTo(result.email);
    } catch (e) {
      if ((e as { status?: number }).status === 409) {
        // Имя или email занят — ошибка у поля имени (варианты показывает проверка доступности).
        form.setError('userName', { message: 'Это имя пользователя или email уже занято' });
        return;
      }
      showApiError(e, form);
    }
  }

  if (sentTo) return <VerifyCodeForm email={sentTo} />;

  let nameError = form.errors.userName;
  if (!nameError && userName && !isUserNameFormatValid(userName)) {
    nameError = 'Только a–z, цифры, «.» и «_», до 30 символов';
  }
  if (!nameError && isTaken) nameError = 'Это имя пользователя уже занято';

  return (
    <AuthPage>
      <AuthCard>
        <p className="text-center text-16 font-semibold text-muted-foreground">
          Зарегистрируйтесь, чтобы смотреть фото и видео ваших друзей.
        </p>
        <OAuthButtons />
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <TextField
            label="Электронный адрес"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            error={form.errors.email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Полное имя"
            name="fullName"
            autoComplete="name"
            maxLength={64}
            value={fullName}
            error={form.errors.fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <TextField
            label="Имя пользователя"
            name="userName"
            autoComplete="username"
            autoCapitalize="none"
            maxLength={30}
            value={userName}
            error={nameError}
            onChange={(e) => setUserName(e.target.value.toLowerCase())}
            hint={
              canCheckName && availability.data?.available ? (
                <p className="flex items-center gap-1 text-12 text-success">
                  <Check className="size-3" aria-hidden="true" /> Имя свободно
                </p>
              ) : null
            }
          />
          {isTaken && availability.data && (
            <UserNameSuggestions
              suggestions={availability.data.suggestions}
              onPick={(name) => setUserName(name)}
            />
          )}
          <TextField
            label="Пароль"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            error={form.errors.password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <BirthdayFields value={birth} onChange={setBirth} error={form.errors.birthday} />
          <Button type="submit" className="h-9 w-full" disabled={!isReady || isLoading}>
            Зарегистрироваться
          </Button>
        </form>
      </AuthCard>
      <AuthSwitchCard text="Есть аккаунт?" linkText="Вход" href="/accounts/login/" />
    </AuthPage>
  );
}
