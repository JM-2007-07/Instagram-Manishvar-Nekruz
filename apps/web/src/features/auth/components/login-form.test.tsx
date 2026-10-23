import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const login = vi.fn();
vi.mock('../api', () => ({
  useLoginMutation: () => [login, { isLoading: false }],
  useLoginTwoFactorMutation: () => [vi.fn(), { isLoading: false }],
  useGetOAuthProvidersQuery: () => ({ data: { google: false, facebook: false } }),
  useResendCodeMutation: () => [vi.fn(), { isLoading: false }],
  useVerifyEmailMutation: () => [vi.fn(), { isLoading: false }],
}));

const resolves = (value: unknown) => ({ unwrap: () => Promise.resolve(value) });
const rejects = (error: unknown) => ({ unwrap: () => Promise.reject(error) });

function fill(loginValue: string, password: string) {
  fireEvent.change(screen.getByLabelText('Имя пользователя или электронный адрес'), {
    target: { value: loginValue },
  });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: password } });
}

describe('LoginForm', () => {
  beforeEach(() => {
    login.mockReset();
    replace.mockReset();
  });

  it('кнопка «Войти» неактивна, пока поля пусты', () => {
    render(<LoginForm />);
    const button = screen.getByRole('button', { name: 'Войти' });
    expect(button).toBeDisabled();
    fill('alice', 'secret1');
    expect(button).toBeEnabled();
  });

  it('показывает ошибку сервера', async () => {
    login.mockReturnValue(
      rejects({
        status: 401,
        data: { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'x' },
      }),
    );
    render(<LoginForm />);
    fill('alice', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('Неверный логин или пароль')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('успешный вход ведёт на главную', async () => {
    login.mockReturnValue(resolves({ id: '1', userName: 'alice' }));
    render(<LoginForm />);
    fill('alice', 'secret1');
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('при включённой 2FA открывает шаг ввода кода', async () => {
    login.mockReturnValue(resolves({ twoFactorRequired: true, challengeId: 'c1' }));
    render(<LoginForm />);
    fill('alice', 'secret1');
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByLabelText('Код')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('показывает ошибку oauth из адреса', () => {
    render(<LoginForm oauthFailed />);
    expect(screen.getByText('Не удалось войти через внешний сервис')).toBeInTheDocument();
  });
});
