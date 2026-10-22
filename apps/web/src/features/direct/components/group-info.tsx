'use client';

import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showApiError } from '@/lib/api/errors';
import type { Chat, MediaItem, UserSummary } from '@/lib/api/types';
import { uploadMedia } from '@/lib/api/upload';
import {
  useAddParticipantsMutation,
  useDeleteChatMutation,
  useMuteChatMutation,
  useRemoveParticipantMutation,
  useSetParticipantAdminMutation,
  useUpdateChatMutation,
} from '../api';
import { getChatAvatarUrl, getChatTitle } from '../chat-utils';
import { ChatAvatar } from './chat-avatar';
import { PeoplePicker } from './people-picker';

// Панель «Информация»: для личного чата — mute и удаление, для группы — ещё название, фото, участники, выход.
export function GroupInfo({
  chat,
  meId,
  onClose,
  onLeft,
}: {
  chat: Chat;
  meId: string;
  onClose: () => void;
  onLeft: () => void;
}) {
  const isGroup = chat.type === 'GROUP';
  const me = chat.participants.find((p) => p.id === meId);
  const isAdmin = me?.role === 'ADMIN';
  const title = getChatTitle(chat, meId);
  const [name, setName] = useState(chat.title ?? '');
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<UserSummary[]>([]);
  const photoInput = useRef<HTMLInputElement>(null);

  const [updateChat, { isLoading: isUpdating }] = useUpdateChatMutation();
  const [addParticipants] = useAddParticipantsMutation();
  const [removeParticipant] = useRemoveParticipantMutation();
  const [setAdmin] = useSetParticipantAdminMutation();
  const [muteChat] = useMuteChatMutation();
  const [deleteChat] = useDeleteChatMutation();

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <aside
      aria-label="Информация о чате"
      className="fixed inset-0 z-30 flex flex-col bg-background md:static md:z-auto md:w-[340px] md:shrink-0 md:border-l md:border-border"
    >
      <header className="flex h-[75px] shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-16 font-semibold">Информация</h2>
        <button type="button" aria-label="Закрыть" onClick={onClose}>
          <X className="size-6" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col items-center gap-2 p-4">
          <ChatAvatar
            url={getChatAvatarUrl(chat, meId)}
            name={title}
            size={80}
            group={chat.type === 'GROUP'}
          />
          {isGroup && (
            <>
              <Button variant="ghost" onClick={() => photoInput.current?.click()}>
                Изменить фото
              </Button>
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                hidden
                aria-label="Фото группы"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void run(async () => {
                    const item = (await uploadMedia(file, 'AVATAR')) as MediaItem;
                    await updateChat({ chatId: chat.id, avatarMediaId: item.id }).unwrap();
                  });
                }}
              />
              <form
                className="flex w-full gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim())
                    void run(() => updateChat({ chatId: chat.id, title: name.trim() }).unwrap());
                }}
              >
                <label className="flex-1">
                  <span className="sr-only">Название группы</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    placeholder="Название группы"
                    className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-14"
                  />
                </label>
                <Button
                  type="submit"
                  disabled={isUpdating || !name.trim() || name.trim() === chat.title}
                >
                  Сохранить
                </Button>
              </form>
            </>
          )}
        </div>

        {isGroup && (
          <section aria-label="Участники" className="border-t border-border">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-14 font-semibold">Участники</h3>
              <Button variant="ghost" onClick={() => setAdding((v) => !v)}>
                {adding ? 'Отмена' : 'Добавить'}
              </Button>
            </div>
            {adding && (
              <div className="flex max-h-72 flex-col border-b border-border">
                <PeoplePicker
                  selected={picked}
                  excludeIds={chat.participants.map((p) => p.id)}
                  onToggle={(user) =>
                    setPicked((list) =>
                      list.some((u) => u.id === user.id)
                        ? list.filter((u) => u.id !== user.id)
                        : [...list, user],
                    )
                  }
                />
                <Button
                  className="m-3"
                  disabled={picked.length === 0}
                  onClick={() =>
                    void run(async () => {
                      await addParticipants({
                        chatId: chat.id,
                        userIds: picked.map((u) => u.id),
                      }).unwrap();
                      setPicked([]);
                      setAdding(false);
                    })
                  }
                >
                  Добавить в группу
                </Button>
              </div>
            )}
            <ul>
              {chat.participants.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2">
                  <ChatAvatar url={p.avatarUrl} name={p.userName} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-14 font-semibold">{p.userName}</span>
                    <span className="block text-12 text-muted-foreground">
                      {p.role === 'ADMIN' ? 'Админ' : p.fullName}
                    </span>
                  </span>
                  {isAdmin && p.id !== meId && (
                    <span className="flex gap-1">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          void run(() =>
                            setAdmin({
                              chatId: chat.id,
                              userId: p.id,
                              admin: p.role !== 'ADMIN',
                            }).unwrap(),
                          )
                        }
                      >
                        {p.role === 'ADMIN' ? 'Снять админа' : 'Админ'}
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          void run(() =>
                            removeParticipant({ chatId: chat.id, userId: p.id }).unwrap(),
                          )
                        }
                      >
                        Удалить
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-col border-t border-border">
          <button
            type="button"
            className="px-4 py-3 text-left text-14 hover:bg-hover-overlay"
            onClick={() =>
              void run(() => muteChat({ chatId: chat.id, mute: !chat.isMuted }).unwrap())
            }
          >
            {chat.isMuted ? 'Включить уведомления' : 'Отключить уведомления'}
          </button>
          {isGroup && (
            <button
              type="button"
              className="px-4 py-3 text-left text-14 font-semibold text-destructive hover:bg-hover-overlay"
              onClick={() =>
                void run(async () => {
                  await removeParticipant({ chatId: chat.id, userId: meId }).unwrap();
                  onLeft();
                })
              }
            >
              Покинуть группу
            </button>
          )}
          <button
            type="button"
            className="px-4 py-3 text-left text-14 font-semibold text-destructive hover:bg-hover-overlay"
            onClick={() =>
              void run(async () => {
                await deleteChat(chat.id).unwrap();
                onLeft();
              })
            }
          >
            Удалить чат
          </button>
        </div>
      </div>
    </aside>
  );
}
