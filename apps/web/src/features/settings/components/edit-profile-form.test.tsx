import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EditProfileForm } from './edit-profile-form';

const updateMe = vi.hoisted(() => vi.fn());
const noop = vi.hoisted(() => () => [() => undefined, { isLoading: false }]);

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/api/upload', () => ({ uploadMedia: vi.fn() }));
vi.mock('./account-identity-forms', () => ({ AccountIdentityForms: () => null }));
vi.mock('@/features/profile/api', () => ({
  useGetMeQuery: () => ({ data: me, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateMeMutation: () => [updateMe, { isLoading: false }],
  useSetAvatarMutation: noop,
  useRemoveAvatarMutation: noop,
  useSetLinksMutation: noop,
}));

const me = vi.hoisted(() => ({
  id: 'u1',
  userName: 'alice',
  fullName: 'Alice',
  avatarUrl: null,
  bio: 'старое',
  pronouns: null,
  gender: null,
  genderCustom: null,
  links: [],
  email: 'a@example.com',
  hasPassword: true,
}));

describe('EditProfileForm', () => {
  beforeEach(() => {
    updateMe.mockReset();
    updateMe.mockReturnValue({ unwrap: () => Promise.resolve(me) });
  });

  it('показывает счётчик «О себе»', () => {
    render(<EditProfileForm />);
    fireEvent.change(screen.getByLabelText('О себе'), { target: { value: 'abc' } });
    expect(screen.getByText('3 / 150')).toBeInTheDocument();
  });

  it('отправляет изменённые поля в PATCH /me', async () => {
    render(<EditProfileForm />);
    fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Alice B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await waitFor(() => expect(updateMe).toHaveBeenCalled());
    expect(updateMe.mock.calls[0][0]).toMatchObject({ fullName: 'Alice B', bio: 'старое' });
  });

  it('блокирует отправку при пустом имени', () => {
    render(<EditProfileForm />);
    fireEvent.change(screen.getByLabelText('Имя'), { target: { value: ' ' } });
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();
  });

  it('показывает поле для своего варианта пола', () => {
    render(<EditProfileForm />);
    fireEvent.change(screen.getByLabelText('Пол'), { target: { value: 'CUSTOM' } });
    expect(screen.getByLabelText('Укажите свой вариант')).toBeInTheDocument();
  });
});
