import 'server-only';
import { cookies } from 'next/headers';

// Только для Server Components (проверка сессии, generateMetadata). Только GET, без кэша.
export async function serverFetch<T>(
  path: string,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const baseUrl = process.env.API_INTERNAL_URL;
  if (!baseUrl) throw new Error('API_INTERNAL_URL is not set');

  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    headers: { cookie: (await cookies()).toString() }, // cookie пользователя пробрасываем в NestJS
    cache: 'no-store', // персональные данные не кэшируются Next.js
  });
  const data = response.ok && response.status !== 204 ? ((await response.json()) as T) : null;
  return { ok: response.ok, status: response.status, data };
}
