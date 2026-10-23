'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showApiError } from '@/lib/api/errors';
import type { UserSummary } from '@/lib/api/types';
import { useCreateChatMutation } from '../api';
import { PeoplePicker } from './people-picker';

// /direct/new/: один выбранный — личный чат (или существующий), несколько — группа.
export function NewChat() {
  const router = useRouter();
  const [selected, setSelected] = useState<UserSummary[]>([]);
  const [title, setTitle] = useState('');
  const [createChat, { isLoading }] = useCreateChatMutation();

  function toggle(user: UserSummary) {
    setSelected((list) =>
      list.some((u) => u.id === user.id) ? list.filter((u) => u.id !== user.id) : [...list, user],
    );
  }

  async function handleCreate() {
    try {
      const chat = await createChat({
        userIds: selected.map((u) => u.id),
        title: selected.length > 1 && title.trim() ? title.trim() : undefined,
      }).unwrap();
      router.push(`/direct/t/${chat.id}/`);
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <section aria-label="Новое сообщение" className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex h-[75px] shrink-0 items-center gap-3 border-b border-border px-4">
        <Link href="/direct/inbox/" aria-label="Назад к чатам" className="md:hidden">
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="flex-1 text-16 font-semibold">Новое сообщение</h1>
        <Button disabled={selected.length === 0 || isLoading} onClick={() => void handleCreate()}>
          {selected.length > 1 ? 'Создать группу' : 'Чат'}
        </Button>
      </header>
      {selected.length > 1 && (
        <label className="block border-b border-border px-4 py-2">
          <span className="sr-only">Название группы</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="Название группы (необязательно)"
            className="w-full bg-transparent text-14 outline-none"
          />
        </label>
      )}
      <PeoplePicker selected={selected} onToggle={toggle} />
    </section>
  );
}
