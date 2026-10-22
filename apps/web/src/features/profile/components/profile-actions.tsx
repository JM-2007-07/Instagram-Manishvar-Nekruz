'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings } from 'lucide-react';
import { FollowButton } from '@/features/users/components/follow-button';
import { ProfileActionsMenu } from '@/features/privacy/components/profile-actions-menu';
import { Button, buttonVariants } from '@/components/ui/button';
import { showApiError } from '@/lib/api/errors';
import type { Profile } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { useCreateChatMutation } from '@/features/direct/api';

export function ProfileActions({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [openChat, { isLoading: isOpening }] = useCreateChatMutation();

  if (profile.isMe) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/accounts/edit/" className={cn(buttonVariants({ variant: 'secondary' }))}>
          Редактировать профиль
        </Link>
        <Link href="/archive/posts/" className={cn(buttonVariants({ variant: 'secondary' }))}>
          Посмотреть архив
        </Link>
        <Link
          href="/accounts/settings/"
          aria-label="Настройки"
          className="flex size-8 items-center justify-center rounded-lg hover:bg-hover-overlay"
        >
          <Settings className="size-6" />
        </Link>
      </div>
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
    <div className="flex flex-wrap items-center gap-2">
      <FollowButton
        userId={profile.id}
        followStatus={profile.followStatus}
        isPrivate={profile.isPrivate}
      />
      <Button variant="secondary" onClick={handleMessage} disabled={isOpening}>
        Отправить сообщение
      </Button>
      <ProfileActionsMenu profile={profile} />
    </div>
  );
}
