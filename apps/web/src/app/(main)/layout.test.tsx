import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MainLayout from './layout';

const serverFetch = vi.fn();
const cookieGet = vi.fn();

vi.mock('@/lib/api/server', () => ({ serverFetch: (path: string) => serverFetch(path) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({
    me,
    theme,
    children,
  }: {
    me: { userName: string };
    theme: string;
    children: React.ReactNode;
  }) => (
    <div>
      <span data-testid="user">{me.userName}</span>
      <span data-testid="theme">{theme}</span>
      {children}
    </div>
  ),
}));

describe('(main)/layout', () => {
  beforeEach(() => {
    serverFetch.mockReset();
    cookieGet.mockReset();
  });

  it('401 -> редирект на страницу входа', async () => {
    serverFetch.mockResolvedValue({ ok: false, status: 401, data: null });
    await expect(MainLayout({ children: null })).rejects.toThrow('REDIRECT:/accounts/login/');
  });

  it('500 -> ошибка, а не редирект', async () => {
    serverFetch.mockResolvedValue({ ok: false, status: 500, data: null });
    await expect(MainLayout({ children: null })).rejects.toThrow('GET /me failed: 500');
  });

  it('200 -> оболочка с пользователем и темой из cookie', async () => {
    serverFetch.mockResolvedValue({ ok: true, status: 200, data: { userName: 'alice' } });
    cookieGet.mockReturnValue({ value: 'dark' });
    render(await MainLayout({ children: <p>content</p> }));
    expect(serverFetch).toHaveBeenCalledWith('/me');
    expect(screen.getByTestId('user')).toHaveTextContent('alice');
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('без cookie тема system', async () => {
    serverFetch.mockResolvedValue({ ok: true, status: 200, data: { userName: 'alice' } });
    cookieGet.mockReturnValue(undefined);
    render(await MainLayout({ children: null }));
    expect(screen.getByTestId('theme')).toHaveTextContent('system');
  });
});
