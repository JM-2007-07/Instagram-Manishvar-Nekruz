'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings, UserPlus } from 'lucide-react';
import { FollowButton } from '@/features/users/components/follow-button';
import { ProfileActionsMenu } from '@/features/privacy/components/profile-actions-menu';
import { Button, buttonVariants } from '@/components/ui/button';
import { showApiError } from '@/lib/api/errors';
import type { Profile } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { useCreateChatMutation } from '@/features/direct/api';

// Кнопки под шапкой: у Instagram высота 44 px и скругление 12 на компьютере, 32 px и 8 на телефоне.
const actionClass = 'h-8 flex-1 rounded-lg px-4 md:h-11 md:rounded-xl md:px-5';

// Значок рядом с именем: свои настройки или меню «…» для чужого профиля.
export function ProfileNameActions({ profile }: { profile: Profile }) {
  if (profile.isMe) {
    return (
      <Link
        href="/accounts/settings/"
        aria-label="Настройки"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-hover-overlay"
      >
        <Settings className="size-6" />
      </Link>
    );
  }
  return <ProfileActionsMenu profile={profile} />;
}

export function ProfileActions({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [openChat, { isLoading: isOpening }] = useCreateChatMutation();

  if (profile.isMe) {
    return (
      <section className="flex gap-2 py-3 md:mt-3">
        <Link
          href="/accounts/edit/"
          className={cn(buttonVariants({ variant: 'secondary' }), actionClass)}
        >
          Редактировать профиль
        </Link>
        <Link
          href="/archive/posts/"
          className={cn(buttonVariants({ variant: 'secondary' }), actionClass)}
        >
          Посмотреть архив
        </Link>
      </section>
    );
  }

  async function handleMessage() {
    try {
      const chat = await openChat({ userIds: [profile.id] }).unwrap();
      router.push(`/direct/t/${chat.id}/`);
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <section className="flex gap-2 py-3 md:mt-3">
      <FollowButton
        userId={profile.id}
        followStatus={profile.followStatus}
        isPrivate={profile.isPrivate}
        className={actionClass}
      />
      <Button
        variant="secondary"
        onClick={handleMessage}
        disabled={isOpening}
        className={cn(actionClass, 'grow-[1.2]')}
      >
        Отправить сообщение
      </Button>
      <Link
        href="/explore/people/"
        aria-label="Похожие аккаунты"
        className={cn(
          buttonVariants({ variant: 'secondary' }),
          'size-8 flex-none rounded-lg p-0 md:size-11 md:rounded-xl',
        )}
      >
        <UserPlus className="size-4" />
      </Link>
    </section>
  );
}
