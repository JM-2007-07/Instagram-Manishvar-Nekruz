'use client';

import { useGetCurrentUserQuery } from '@/features/posts/api';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGetPostByShortcodeQuery } from '@/features/posts/api';
import { ReelItem } from './reel-item';
import { ReelSkeleton } from './reel-skeleton';
import { reelsHeight } from './reels-feed';

// /reel/{shortcode}/ — один ролик в том же виде.
export function SingleReel({ shortcode }: { shortcode: string }) {
  const { data: post, isLoading, error, refetch } = useGetPostByShortcodeQuery(shortcode);
  const { data: me } = useGetCurrentUserQuery();
  const [muted, setMuted] = useState(true);

  if (isLoading) {
    return (
      <div className={reelsHeight}>
        <ReelSkeleton />
      </div>
    );
  }
  if (error || !post) {
    const notFound = !!error && 'status' in error && error.status === 404;
    return (
      <div className={`${reelsHeight} flex flex-col items-center justify-center gap-4`}>
        <p className="text-14 text-muted-foreground">
          {notFound ? 'К сожалению, эта страница недоступна.' : 'Не удалось загрузить Reel.'}
        </p>
        {!notFound && <Button onClick={() => void refetch()}>Повторить</Button>}
      </div>
    );
  }
  return (
    <div className={reelsHeight}>
      <ReelItem post={post} myId={me?.id} muted={muted} onToggleMute={() => setMuted((m) => !m)} />
    </div>
  );
}
