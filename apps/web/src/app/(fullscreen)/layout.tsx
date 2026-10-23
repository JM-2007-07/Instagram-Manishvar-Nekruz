import { redirect } from 'next/navigation';
import { serverFetch } from '@/lib/api/server';
import type { Me } from '@/lib/api/types';

// Полноэкранные страницы (просмотрщик историй) — без оболочки, но с той же проверкой сессии.
export default async function FullscreenLayout({ children }: { children: React.ReactNode }) {
  const res = await serverFetch<Me>('/me');

  if (res.status === 401) redirect('/accounts/login/');
  if (!res.ok) throw new Error(`GET /me failed: ${res.status}`);

  return <div className="fixed inset-0 bg-media-backdrop">{children}</div>;
}
