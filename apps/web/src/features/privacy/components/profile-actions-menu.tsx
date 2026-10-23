'use client';

import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { Ellipsis } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { showApiError } from '@/lib/api/errors';
import type { Profile } from '@/lib/api/types';
import {
  useBlockUserMutation,
  useMuteUserMutation,
  useRestrictUserMutation,
  useUnblockUserMutation,
  useUnmuteUserMutation,
  useUnrestrictUserMutation,
} from '../api';

type MenuProfile = Pick<Profile, 'id' | 'userName' | 'isBlocked' | 'isRestricted' | 'isMuted'>;

// Кнопка «…» в шапке чужого профиля: заблокировать / ограничить / скрыть публикации и истории.
// Данные берутся из профиля (ProfileDto); после действия теги 'Privacy' и {User, id} обновят профиль.
export function ProfileActionsMenu({ profile }: { profile: MenuProfile }) {
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [block, { isLoading: blocking }] = useBlockUserMutation();
  const [unblock] = useUnblockUserMutation();
  const [restrict] = useRestrictUserMutation();
  const [unrestrict] = useUnrestrictUserMutation();
  const [mute] = useMuteUserMutation();
  const [unmute] = useUnmuteUserMutation();

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (error) {
      showApiError(error);
    }
  }

  // Скрытие публикаций и историй — один ресурс: PUT с двумя флагами, оба false = DELETE.
  function toggleMute(part: 'posts' | 'stories') {
    const next = { ...profile.isMuted, [part]: !profile.isMuted[part] };
    return run(() =>
      next.posts || next.stories
        ? mute({ userId: profile.id, ...next }).unwrap()
        : unmute(profile.id).unwrap(),
    );
  }

  async function handleBlock() {
    try {
      await block(profile.id).unwrap();
      setConfirmBlock(false);
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Параметры профиля"
          className="flex size-8 items-center justify-center rounded-lg outline-none hover:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Ellipsis className="size-6" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {profile.isBlocked ? (
            <DropdownMenuItem onSelect={() => run(() => unblock(profile.id).unwrap())}>
              Разблокировать
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="text-destructive" onSelect={() => setConfirmBlock(true)}>
              Заблокировать
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() =>
              run(() =>
                profile.isRestricted
                  ? unrestrict(profile.id).unwrap()
                  : restrict(profile.id).unwrap(),
              )
            }
          >
            {profile.isRestricted ? 'Снять ограничение' : 'Ограничить'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => toggleMute('posts')}>
            {profile.isMuted.posts ? 'Показывать публикации' : 'Скрыть публикации'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => toggleMute('stories')}>
            {profile.isMuted.stories ? 'Показывать истории' : 'Скрыть истории'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog.Root open={confirmBlock} onOpenChange={setConfirmBlock}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-background-elevated p-6 text-center shadow-[var(--shadow-strong)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150">
            <Dialog.Title className="text-18 font-semibold">
              Заблокировать {profile.userName}?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-14 text-muted-foreground">
              Этот человек больше не сможет видеть ваш профиль и публикации, писать вам и искать
              вас. Он не узнает о блокировке.
            </Dialog.Description>
            <div className="mt-6 flex flex-col gap-2">
              <Button variant="destructive" disabled={blocking} onClick={handleBlock}>
                Заблокировать
              </Button>
              <Dialog.Close asChild>
                <Button variant="secondary">Отмена</Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
