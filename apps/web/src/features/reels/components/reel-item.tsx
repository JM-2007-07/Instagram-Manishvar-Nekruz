'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Play,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { SaveButton } from '@/components/temp/student-a';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SharePostDialog } from '@/features/direct/components/share-post-dialog';
import { useLikePostMutation } from '@/features/posts/api';
import type { Post } from '@/features/posts/types';
import { cn } from '@/lib/utils';
import { usePlayReelMutation } from '../api';
import { StoryAvatar } from '@/features/stories/components/story-avatar-link';

type Props = {
  post: Post;
  muted: boolean;
  onToggleMute: () => void;
};

const actionClass =
  'flex flex-col items-center gap-1 p-2 text-12 font-semibold drop-shadow md:text-foreground md:drop-shadow-none';

// Один ролик: видео 9:16, справа столбец действий, внизу автор и подпись.
export function ReelItem({ post, muted, onToggleMute }: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playSent = useRef(false); // plays — один раз на ролик за просмотр
  const [active, setActive] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [liked, setLiked] = useState(post.isLikedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [bigHeart, setBigHeart] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Состояние видео: загружается (или буферизуется), готово, ошибка — у каждого свой вид поверх ролика.
  const [videoState, setVideoState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [likePost] = useLikePostMutation();
  const [sendPlay] = usePlayReelMutation();

  const media = post.items[0]?.media;
  const postUrl = `/p/${post.shortcode}/`;

  // Играет только видимый ролик (≥ 60 % высоты).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.intersectionRatio >= 0.6),
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active && !userPaused) void video.play()?.catch(() => {});
    else video.pause();
  }, [active, userPaused]);

  // Ушли со страницы — видео остановлено (не играет в фоне).
  useEffect(() => {
    const video = videoRef.current;
    return () => video?.pause();
  }, []);

  function retry() {
    setVideoState('loading');
    videoRef.current?.load();
  }

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  async function setLike(next: boolean) {
    const prev = { liked, likeCount };
    setLiked(next);
    setLikeCount((c) => (c === null ? c : c + (next ? 1 : -1)));
    try {
      await likePost({ postId: post.id, liked: next }).unwrap();
    } catch {
      setLiked(prev.liked); // откат
      setLikeCount(prev.likeCount);
    }
  }

  function onDoubleClick() {
    setBigHeart(true);
    setTimeout(() => setBigHeart(false), 900);
    if (!liked) void setLike(true);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/reel/${post.shortcode}/`);
      toast('Ссылка скопирована в буфер обмена.');
    } catch {
      toast('Не удалось скопировать ссылку.');
    }
  }

  const caption = post.caption ?? '';
  const isLong = caption.length > 60 || caption.includes('\n');

  const actions = (
    <>
      <button
        type="button"
        aria-label={liked ? 'Не нравится' : 'Нравится'}
        aria-pressed={liked}
        className={actionClass}
        onClick={() => void setLike(!liked)}
      >
        <Heart className={cn('size-6', liked && 'animate-like-pop fill-badge text-badge')} />
        {likeCount !== null && <span>{likeCount}</span>}
      </button>
      <Link href={postUrl} aria-label="Комментировать" className={actionClass}>
        <MessageCircle className="size-6" />
        <span>{post.commentCount}</span>
      </Link>
      <button
        type="button"
        aria-label="Поделиться"
        className={actionClass}
        onClick={() => setSharing(true)}
      >
        <Send className="size-6" />
      </button>
      <SharePostDialog
        postId={post.id}
        shortcode={post.shortcode}
        open={sharing}
        onOpenChange={setSharing}
      />
      <SaveButton postId={post.id} isSavedByMe={post.isSavedByMe} />
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Ещё" className={actionClass}>
          <MoreHorizontal className="size-6" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => router.push(postUrl)}>
            Перейти к публикации
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void copyLink()}>Копировать ссылку</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <div
      ref={rootRef}
      className="flex h-full snap-start snap-always items-end justify-center md:gap-4 md:py-2"
    >
      <div className="relative aspect-[9/16] h-full max-w-full overflow-hidden bg-media-backdrop md:rounded-lg">
        {media && (
          <video
            ref={videoRef}
            src={media.url}
            poster={media.thumbnailUrl ?? undefined}
            aria-label={`Reel: ${post.author.userName}`}
            className="size-full cursor-pointer object-cover"
            loop
            muted
            playsInline
            preload="metadata"
            onPlay={() => {
              if (playSent.current) return;
              playSent.current = true;
              void sendPlay(post.id);
            }}
            onClick={() => setUserPaused((p) => !p)}
            onDoubleClick={onDoubleClick}
            onWaiting={() => setVideoState('loading')}
            onCanPlay={() => setVideoState('ready')}
            onPlaying={() => setVideoState('ready')}
            onError={() => setVideoState('error')}
          />
        )}

        {videoState === 'loading' && active && !userPaused && (
          <span
            role="status"
            aria-label="Видео загружается"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <Loader2 className="size-10 animate-spin text-white/80 drop-shadow" aria-hidden />
          </span>
        )}
        {videoState === 'error' && (
          <div
            role="alert"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-media-backdrop text-center text-white"
          >
            <p className="text-14">Не удалось загрузить видео</p>
            <button
              type="button"
              onClick={retry}
              className="flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-14 font-semibold hover:bg-white/25"
            >
              <RotateCcw className="size-4" aria-hidden /> Повторить
            </button>
          </div>
        )}

        {userPaused && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-overlay text-white">
              <Play className="size-8 fill-current" aria-hidden />
            </span>
          </span>
        )}
        {bigHeart && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Heart
              className="animate-heart-burst size-24 fill-white text-white drop-shadow-lg"
              aria-hidden
            />
          </span>
        )}

        <button
          type="button"
          aria-label={muted ? 'Включить звук' : 'Отключить звук'}
          onClick={onToggleMute}
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-overlay text-white"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>

        {/* Низ видео: автор и подпись */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 pr-16 text-white md:pr-4">
          <div className="pointer-events-auto flex items-center gap-2">
            <StoryAvatar user={post.author} size={32} fallbackHref={`/${post.author.userName}/`} />
            <Link href={`/${post.author.userName}/`} className="text-14 font-semibold drop-shadow">
              {post.author.userName}
            </Link>
            {/* TODO(Студент A): «• Подписаться», когда FollowButton A будет знать статус подписки. */}
          </div>
          {caption && (
            <p
              className={cn(
                'pointer-events-auto mt-2 text-14 drop-shadow',
                !expanded && 'truncate',
              )}
            >
              {expanded || !isLong ? caption : caption.slice(0, 60)}
              {isLong && !expanded && (
                <button
                  type="button"
                  className="ml-1 text-white/70"
                  onClick={() => setExpanded(true)}
                >
                  ещё
                </button>
              )}
            </p>
          )}
        </div>

        {/* Мобильный столбец действий — поверх видео */}
        <div className="absolute bottom-16 right-1 flex flex-col items-center text-white md:hidden">
          {actions}
        </div>
      </div>

      {/* Десктопный столбец действий — справа от видео */}
      <div className="hidden flex-col items-center pb-2 md:flex">{actions}</div>
    </div>
  );
}
