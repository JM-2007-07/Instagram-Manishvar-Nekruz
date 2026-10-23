'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MoreHorizontal, Send } from 'lucide-react';
import { NavBadge } from '@/features/notifications/components/nav-badge';
import { useGetChatsInfiniteQuery } from '../api';
import { getChatAvatarUrl, getChatTitle } from '../chat-utils';
import { ChatAvatar } from './chat-avatar';

/**
 * Плавающая кнопка «Сообщения» в правом нижнем углу (как у Instagram на компьютере):
 * значок с числом непрочитанных чатов, подпись и фото трёх последних собеседников.
 * Не показывается на телефоне и в самом Direct.
 */
export function MessagesDock({ meId }: { meId: string }) {
  const pathname = usePathname();
  const hidden = pathname.startsWith('/direct');
  const { data } = useGetChatsInfiniteQuery('PRIMARY', { skip: hidden });
  if (hidden) return null;

  const chats = data?.pages.flatMap((p) => p.items).slice(0, 3) ?? [];
  return (
    <Link
      href="/direct/inbox/"
      aria-label="Сообщения"
      className="fixed right-6 bottom-6 z-40 hidden h-14 items-center gap-3 rounded-full bg-popover pr-3 pl-5 text-popover-foreground shadow-[var(--shadow-strong)] transition-transform hover:scale-[1.02] md:flex"
    >
      <span className="relative">
        <Send className="size-6" aria-hidden />
        <NavBadge kind="messages" />
      </span>
      <span className="text-16 font-semibold">Сообщения</span>
      {chats.length > 0 && (
        <span className="flex items-center pl-1">
          {chats.map((chat) => (
            <span key={chat.id} className="-ml-2 rounded-full ring-2 ring-popover first:ml-0">
              <ChatAvatar
                url={getChatAvatarUrl(chat, meId)}
                name={getChatTitle(chat, meId)}
                size={24}
              />
            </span>
          ))}
          <span className="-ml-2 flex size-6 items-center justify-center rounded-full bg-background-secondary ring-2 ring-popover">
            <MoreHorizontal className="size-4" aria-hidden />
          </span>
        </span>
      )}
    </Link>
  );
}
