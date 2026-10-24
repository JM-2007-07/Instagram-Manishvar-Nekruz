'use client';

import { useState } from 'react';
import { Check, Link2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useGetMeQuery } from '@/features/profile/api';
import { useAccountSearch } from '@/features/search/user-search';
import { useDebouncedValue } from '@/features/users/use-debounced-value';
import { showApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { useGetChatsInfiniteQuery, useSendMessageMutation, useSharePostMutation } from '../api';
import { getChatAvatarUrl, getChatTitle } from '../chat-utils';
import { ChatAvatar } from './chat-avatar';

// Кому отправить: существующий чат или человек из поиска (личный чат найдёт или создаст сервер).
type Target = {
  key: string;
  chatId?: string;
  userId?: string;
  name: string;
  avatarUrl: string | null;
  group: boolean;
};

function TargetTile({
  target,
  selected,
  onToggle,
}: {
  target: Target;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={target.name}
      onClick={onToggle}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl px-1 py-2.5 outline-none hover:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'bg-hover-overlay',
      )}
    >
      <span className="relative">
        <ChatAvatar url={target.avatarUrl} name={target.name} size={92} group={target.group} />
        {selected && (
          <span className="absolute right-0 bottom-0 flex size-6 items-center justify-center rounded-full border-2 border-popover bg-primary text-primary-foreground">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="line-clamp-2 w-full text-center text-14 leading-[18px]">{target.name}</span>
    </button>
  );
}

/**
 * «Поделиться» публикацией (как у Instagram): поиск, сетка недавних чатов или найденных людей,
 * выбор нескольких, необязательное сообщение и «Отправить». Без выбора — «Копировать ссылку».
 * Отправка — POST /messages/share; сообщение уходит отдельным текстом в каждый из этих чатов.
 * Пока окно закрыто, его содержимое (и запросы чатов и поиска) не создаётся.
 */
export function SharePostDialog(props: ShareProps) {
  return props.open ? <SharePostWindow {...props} /> : null;
}

type ShareProps = {
  postId: string;
  shortcode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function SharePostWindow({ postId, shortcode, open, onOpenChange }: ShareProps) {
  const { data: me } = useGetMeQuery();
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<Target[]>([]);
  const q = useDebouncedValue(query.trim(), 300);
  const chats = useGetChatsInfiniteQuery('PRIMARY');
  const people = useAccountSearch(q);
  const [sharePost, { isLoading: sharing }] = useSharePostMutation();
  const [sendMessage] = useSendMessageMutation();

  const meId = me?.id ?? '';
  const targets: Target[] = q
    ? (people.data?.items ?? [])
        .filter((u) => u.id !== meId)
        .map((u) => ({
          key: `u:${u.id}`,
          userId: u.id,
          name: u.userName,
          avatarUrl: u.avatarUrl,
          group: false,
        }))
    : (chats.data?.pages.flatMap((p) => p.items) ?? []).map((c) => ({
        key: `c:${c.id}`,
        chatId: c.id,
        name: getChatTitle(c, meId),
        avatarUrl: getChatAvatarUrl(c, meId),
        group: c.type === 'GROUP',
      }));
  const loading = q ? people.isPending : chats.isLoading;
  const isSelected = (t: Target) => selected.some((s) => s.key === t.key);

  function toggle(target: Target) {
    setSelected((list) =>
      list.some((s) => s.key === target.key)
        ? list.filter((s) => s.key !== target.key)
        : [...list, target],
    );
  }

  function reset(next: boolean) {
    if (!next) {
      setQuery('');
      setText('');
      setSelected([]);
    }
    onOpenChange(next);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${shortcode}/`);
      toast('Ссылка скопирована в буфер обмена');
    } catch {
      toast.error('Не удалось скопировать ссылку');
    }
  }

  async function send() {
    try {
      const { messages } = await sharePost({
        postId,
        chatIds: selected.flatMap((t) => (t.chatId ? [t.chatId] : [])),
        userIds: selected.flatMap((t) => (t.userId ? [t.userId] : [])),
      }).unwrap();
      const message = text.trim();
      if (message) {
        const chatIds = [...new Set(messages.map((m) => m.chatId))];
        await Promise.all(
          chatIds.map((chatId) =>
            sendMessage({
              chatId,
              body: { type: 'TEXT', text: message, clientId: crypto.randomUUID() },
            }).unwrap(),
          ),
        );
      }
      toast(selected.length > 1 ? 'Отправлено' : `Отправлено: ${selected[0]?.name}`);
      reset(false);
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent
        showClose={false}
        className="flex max-h-[min(640px,calc(100dvh-40px))] w-[min(685px,calc(100vw-32px))] flex-col overflow-hidden rounded-[28px] bg-popover p-0 text-popover-foreground"
      >
        <div className="relative flex h-[72px] shrink-0 items-center justify-center">
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => reset(false)}
            className="absolute left-5 flex size-10 items-center justify-center rounded-full hover:bg-hover-overlay"
          >
            <X className="size-7" />
          </button>
          <DialogTitle className="text-16 font-bold">Поделиться</DialogTitle>
        </div>

        <label className="mx-5 flex h-11 shrink-0 items-center gap-3 rounded-xl bg-background-secondary px-5">
          <Search className="size-5 text-muted-foreground" aria-hidden />
          <span className="sr-only">Поиск</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 50))}
            placeholder="Поиск"
            className="min-w-0 flex-1 bg-transparent text-16 outline-none placeholder:text-muted-foreground"
          />
        </label>

        <div className="mt-3 min-h-[200px] flex-1 overflow-y-auto px-4 pb-2">
          {loading ? (
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4" aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 py-2.5">
                  <span className="size-[92px] animate-pulse rounded-full bg-background-secondary" />
                  <span className="h-3 w-20 animate-pulse rounded bg-background-secondary" />
                </div>
              ))}
            </div>
          ) : targets.length === 0 ? (
            <p className="py-10 text-center text-14 text-muted-foreground">
              {q ? 'Аккаунты не найдены' : 'Нет недавних чатов. Найдите человека через поиск.'}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
              {targets.map((t) => (
                <TargetTile
                  key={t.key}
                  target={t}
                  selected={isSelected(t)}
                  onToggle={() => toggle(t)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-5 pt-3 pb-5">
          {selected.length > 0 ? (
            <>
              <input
                aria-label="Сообщение"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={2000}
                placeholder="Напишите сообщение…"
                className="mb-3 h-11 w-full bg-transparent px-1 text-15 outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                disabled={sharing}
                onClick={() => void send()}
                className="h-11 w-full rounded-xl bg-primary text-15 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {selected.length > 1 ? 'Отправить по отдельности' : 'Отправить'}
              </button>
            </>
          ) : (
            <div className="flex">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="flex w-[92px] flex-col items-center gap-2 text-12"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-background-secondary">
                  <Link2 className="size-6" />
                </span>
                Копировать ссылку
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
