import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { StoreProvider } from '@/lib/store-provider';
import { Toaster } from '@/components/ui/sonner';
import { APP_NAME } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = { title: APP_NAME };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Тема хранится в cookie `theme`. Переключатель и режим «как в системе» — в T0.7.
  const theme = (await cookies()).get('theme')?.value;

  return (
    <html lang="ru" className={theme === 'dark' ? 'dark' : undefined}>
      <body>
        <StoreProvider>{children}</StoreProvider>
        <Toaster />
      </body>
    </html>
  );
}
