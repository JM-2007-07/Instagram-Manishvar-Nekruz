import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { serverFetch } from '@/lib/api/server';
import type { Me } from '@/lib/api/types';
import { parseTheme, THEME_COOKIE } from '@/lib/theme';

// Проверка сессии: гость → страница входа, ошибка API → error boundary (не «гость»).
export default async function MainLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const res = await serverFetch<Me>('/me');

  if (res.status === 401) redirect('/accounts/login/');
  if (!res.ok || !res.data) throw new Error(`GET /me failed: ${res.status}`);

  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <AppShell me={res.data} theme={theme}>
      {children}
      {modal}
    </AppShell>
  );
}
