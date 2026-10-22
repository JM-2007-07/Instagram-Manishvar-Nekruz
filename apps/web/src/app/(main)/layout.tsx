import { redirect } from 'next/navigation';
import { serverFetch } from '@/lib/api/server';
import type { Me } from '@/lib/api/types';

// Проверка сессии: гость → страница входа, ошибка API → error boundary (не «гость»).
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const res = await serverFetch<Me>('/me');

  if (res.status === 401) redirect('/accounts/login/');
  if (!res.ok) throw new Error(`GET /me failed: ${res.status}`);

  // шаг 4: AppShell с me
  return <div>{children}</div>;
}
