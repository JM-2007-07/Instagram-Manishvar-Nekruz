import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { StoreProvider } from '@/lib/store-provider';
import { Toaster } from '@/components/ui/sonner';
import { APP_NAME } from '@/lib/config';
import { THEME_COOKIE, THEME_SCRIPT, parseTheme } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = { title: APP_NAME };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Тема хранится в cookie `theme`. dark — класс сразу на сервере;
  // system — класс ставит THEME_SCRIPT до отрисовки (без мигания).
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html lang="ru" className={theme === 'dark' ? 'dark' : undefined} suppressHydrationWarning>
      <head>
        {theme === 'system' && <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />}
      </head>
      <body>
        <StoreProvider>{children}</StoreProvider>
        <Toaster />
      </body>
    </html>
  );
}
