'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChatList } from './chat-list';

// CallManager и события чатов подключены в оболочке (AppShell / RealtimeBridge).
// Двухколоночная раскладка Direct (SCREENS §3.11). На мобильном — по одному экрану.
export function DirectLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chatId = /^\/direct\/t\/([^/]+)/.exec(pathname)?.[1];
  const listOnly = pathname.startsWith('/direct/inbox') || pathname.startsWith('/direct/requests');

  return (
    <div className="flex h-[calc(100dvh-110px)] md:h-screen">
      <div
        className={cn(
          'w-full shrink-0 border-border md:block md:w-[397px] md:border-r',
          listOnly ? 'block' : 'hidden',
        )}
      >
        <ChatList
          initialFolder={pathname.startsWith('/direct/requests') ? 'REQUESTS' : 'PRIMARY'}
          activeChatId={chatId}
        />
      </div>
      <div className={cn('min-w-0 flex-1 md:flex', listOnly ? 'hidden' : 'flex')}>{children}</div>
    </div>
  );
}
