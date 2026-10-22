import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SignupForm } from './signup-form';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('../api', () => ({
  useRegisterMutation: () => [vi.fn(), { isLoading: false }],
  useGetOAuthProvidersQuery: () => ({ data: { google: false, facebook: false } }),
  useResendCodeMutation: () => [vi.fn(), { isLoading: false }],
  useVerifyEmailMutation: () => [vi.fn(), { isLoading: false }],
  // Любое проверяемое имя «занято» с вариантами.
  useCheckUserNameQuery: () => ({
    data: { available: false, suggestions: ['ivan_1', 'ivan.1'] },
  }),
}));

describe('SignupForm: проверка имени', () => {
  it('занятое имя: ошибка и подсказки, подсказка подставляется в поле', async () => {
    render(<SignupForm />);
    const input = screen.getByLabelText('Имя пользователя');
    fireEvent.change(input, { target: { value: 'ivan' } });

    expect(
      await screen.findByText('Это имя пользователя уже занято', {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ivan_1' }));
    expect(input).toHaveValue('ivan_1');
  });
});
