'use client';

import { useGetCurrentUserQuery } from '@/features/posts/api';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  MoreHorizontal,
  Pause,
  Play,
  Send,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/temp/student-a';
import { BrandLogo } from '@/components/layout/brand-logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import {
  useDeleteHighlightMutation,
  useDeleteStoryMutation,
  useLikeStoryMutation,
  useReactStoryMutation,
  useReplyStoryMutation,
  useSetHighlightStoriesMutation,
  useUpdateHighlightMutation,
  useViewStoryMutation,
} from '../api';
import type { Story } from '../types';
import { storyPath, timeAgo } from '../utils';
import { CreateHighlightDialog } from './create-highlight-dialog';
import { ConfirmDialog, RenameDialog, ViewersDialog } from './story-dialogs';

const TICK_MS = 50;
const HOLD_MS = 250; // дольше — это удержание (пауза), а не клик
const EMOJIS = ['😂', '😮', '😍', '😢', '👏', '🔥', '🎉', '💯'];

type Dialog = 'delete' | 'addHighlight' | 'rename' | 'deleteHighlight' | 'viewers' | null;

// Стикеры: показываем только текстовые (упоминание, хештег, место, ссылка) белыми плашками.
function stickerText(sticker: Story['stickers'][number]): string | null {
  const d = sticker.data;
  switch (sticker.type) {
    case 'MENTION':
      return `@${String(d.userName ?? 'упоминание')}`;
    case 'HASHTAG':
      return `#${String(d.tag ?? '')}`;
    case 'LOCATION':
      return String(d.name ?? 'Место');
    case 'LINK':
      try {
        return new URL(String(d.url)).hostname;
      } catch {
        return String(d.url ?? 'Ссылка');
      }
    default:
      return null;
  }
}

type PlayerProps = {
  /** Истории одного автора (или актуального) по порядку показа. */
  stories: Story[];
  startIndex?: number;
  onClose: () => void;
  /** Переход к предыдущему / следующему автору; без них — конец списка. */
  onPrevAuthor?: () => void;
  onNextAuthor?: () => void;
  /** Задан в просмотрщике актуального. */
  highlight?: { id: string; title: string };
};

/** Полноэкранный просмотрщик: рамка 9:16, управление, клавиши, переход между авторами. */
export function StoryPlayer({
  stories,
  startIndex = 0,
  onClose,
  onPrevAuthor,
  onNextAuthor,
  highlight,
}: PlayerProps) {
  const [index, setIndex] = useState(startIndex);
  const [restart, setRestart] = useState(0);
  const current = stories[Math.min(index, stories.length - 1)];

  // Список опустел (удалили последнюю историю) — закрываемся.
  useEffect(() => {
    if (!current) onClose();
  }, [current, onClose]);

  function goNext() {
    if (index < stories.length - 1) setIndex(index + 1);
    else (onNextAuthor ?? onClose)();
  }
  function goPrev() {
    if (index > 0) setIndex(index - 1);
    else if (onPrevAuthor) onPrevAuthor();
    else setRestart(restart + 1); // первая история — начинаем заново
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (document.querySelector('[role="dialog"],[role="menu"]')) return; // окна сами обработают Esc
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!current) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-media-backdrop">
      <Link href="/" aria-label="На главную" className="absolute top-3 left-4 z-20">
        <BrandLogo className="text-white" />
      </Link>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute top-3 right-3 z-20 flex size-10 items-center justify-center text-white"
      >
        <X className="size-6" />
      </button>

      {onPrevAuthor && (
        <button
          type="button"
          aria-label="Предыдущий автор"
          onClick={onPrevAuthor}
          className="mr-4 hidden size-8 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[var(--shadow-strong)] md:flex"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}

      <StoryView
        key={`${current.id}-${restart}`}
        story={current}
        index={Math.min(index, stories.length - 1)}
        stories={stories}
        highlight={highlight}
        onNext={goNext}
        onPrev={goPrev}
        onClose={onClose}
        onPrevAuthor={onPrevAuthor}
        onNextAuthor={onNextAuthor}
      />

      {onNextAuthor && (
        <button
          type="button"
          aria-label="Следующий автор"
          onClick={onNextAuthor}
          className="ml-4 hidden size-8 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[var(--shadow-strong)] md:flex"
        >
          <ChevronRight className="size-5" />
        </button>
      )}
    </div>
  );
}

function StoryView({
  story,
  stories,
  index,
  highlight,
  onNext,
  onPrev,
  onClose,
  onPrevAuthor,
  onNextAuthor,
}: {
  story: Story;
  stories: Story[];
  index: number;
  highlight?: PlayerProps['highlight'];
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onPrevAuthor?: () => void;
  onNextAuthor?: () => void;
}) {
  const { data: me } = useGetCurrentUserQuery();
  const isOwn = !!me && me.id === story.author.id;

  const [elapsed, setElapsed] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(story.isLikedByMe);
  const [text, setText] = useState('');
  const paused = userPaused || holding || focused || menuOpen || dialog !== null;

  const isVideo = story.media?.kind === 'VIDEO';
  const durationMs =
    (isVideo ? (story.media?.durationSec ?? story.durationSec) : story.durationSec) * 1000;

  const videoRef = useRef<HTMLVideoElement>(null);
  const endedRef = useRef(false);
  const viewedRef = useRef(false);
  const gesture = useRef({ x: 0, y: 0, t: 0, ignoreClick: false });

  const [viewStory] = useViewStoryMutation();
  const [likeStory] = useLikeStoryMutation();
  const [replyStory, { isLoading: replying }] = useReplyStoryMutation();
  const [reactStory] = useReactStoryMutation();
  const [deleteStory] = useDeleteStoryMutation();
  const [deleteHighlight] = useDeleteHighlightMutation();
  const [updateHighlight] = useUpdateHighlightMutation();
  const [setHighlightStories] = useSetHighlightStoriesMutation();

  // Таймер прогресса: идёт, пока нет паузы.
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setElapsed((e) => e + TICK_MS), TICK_MS);
    return () => clearInterval(timer);
  }, [paused]);

  // Конец времени — следующая история (один раз; при смене истории компонент создаётся заново).
  useEffect(() => {
    if (elapsed >= durationMs && !endedRef.current) {
      endedRef.current = true;
      onNext();
    }
  });

  // Видео следует за паузой и звуком.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else void video.play?.()?.catch?.(() => {});
  }, [paused]);

  // Просмотр засчитываем один раз (своя история и уже просмотренная — не нужно).
  useEffect(() => {
    if (!me || isOwn || story.isViewedByMe || viewedRef.current) return;
    viewedRef.current = true;
    void viewStory({
      storyId: story.id,
      authorId: story.author.id,
      isLast: index === stories.length - 1,
    });
  }, [me, isOwn, story, index, stories.length, viewStory]);

  // Жесты: удержание — пауза, свайп вниз — закрыть, влево/вправо — автор.
  function onPointerDown(e: React.PointerEvent) {
    gesture.current = { x: e.clientX ?? 0, y: e.clientY ?? 0, t: Date.now(), ignoreClick: false };
    setHolding(true);
  }
  function onPointerUp(e: React.PointerEvent) {
    setHolding(false);
    const g = gesture.current;
    const dx = (e.clientX ?? 0) - g.x;
    const dy = (e.clientY ?? 0) - g.y;
    if (Math.abs(dy) > 80 && dy > 0 && Math.abs(dy) > Math.abs(dx)) {
      g.ignoreClick = true;
      onClose();
    } else if (Math.abs(dx) > 80) {
      g.ignoreClick = true;
      if (dx < 0) onNextAuthor?.();
      else onPrevAuthor?.();
    } else {
      g.ignoreClick = Date.now() - g.t > HOLD_MS || Math.abs(dx) > 10 || Math.abs(dy) > 10;
    }
  }
  function tap(action: () => void) {
    if (!gesture.current.ignoreClick) action();
  }

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    try {
      await likeStory({ storyId: story.id, liked: next }).unwrap();
    } catch (e) {
      setLiked(!next);
      toast.error(getApiError(e).message);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    try {
      await replyStory({ storyId: story.id, text: value }).unwrap();
      setText('');
      setFocused(false);
      (document.activeElement as HTMLElement | null)?.blur();
      toast.success('Отправлено');
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  }

  async function sendReaction(emoji: string) {
    try {
      await reactStory({ storyId: story.id, emoji }).unwrap();
      toast.success('Отправлено');
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  }

  async function share() {
    const url = `${window.location.origin}${storyPath(story.author.userName, story.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Ссылка скопирована');
    } catch {
      toast.error('Не удалось скопировать ссылку');
    }
  }

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (e) {
      toast.error(getApiError(e).message);
    }
  }

  const iconBtn = 'flex size-8 items-center justify-center text-white';

  return (
    <div className="relative aspect-[9/16] h-full max-h-full max-w-full overflow-hidden bg-media-backdrop md:h-[calc(100dvh-32px)] md:rounded-lg">
      {/* Слой медиа и жестов */}
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setHolding(false)}
      >
        {story.media?.kind === 'VIDEO' ? (
          <video
            ref={videoRef}
            src={story.media.url}
            poster={story.media.thumbnailUrl ?? undefined}
            muted={muted}
            autoPlay
            playsInline
            className="size-full object-cover"
          />
        ) : story.media ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.media.url}
            alt={`История ${story.author.userName}`}
            className="size-full object-cover"
          />
        ) : story.sharedPost?.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.sharedPost.previewUrl}
            alt="Публикация"
            className="size-full object-contain"
          />
        ) : null}

        {story.stickers.map((sticker) => {
          const label = stickerText(sticker);
          if (!label) return null;
          return (
            <span
              key={sticker.id}
              className="absolute rounded-lg bg-white px-3 py-1 text-14 font-semibold text-black"
              style={{
                left: `${sticker.x * 100}%`,
                top: `${sticker.y * 100}%`,
                transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
              }}
            >
              {label}
            </span>
          );
        })}

        <button
          type="button"
          tabIndex={-1}
          aria-label="Предыдущая история"
          onClick={() => tap(onPrev)}
          className="absolute inset-y-0 left-0 w-1/3"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Следующая история"
          onClick={() => tap(onNext)}
          className="absolute inset-y-0 right-0 w-2/3"
        />
      </div>

      {/* Верх: полоски, автор, кнопки */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/40 to-transparent px-2 pt-2 pb-6">
        <div className="flex gap-1" role="progressbar" aria-label="Прогресс историй">
          {stories.map((s, i) => (
            <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
              <div
                data-testid="story-progress"
                className="h-full bg-white"
                style={{
                  width: `${i < index ? 100 : i === index ? Math.min(100, (elapsed / durationMs) * 100) : 0}%`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="pointer-events-auto mt-3 flex items-center gap-2">
          <Link href={`/${story.author.userName}/`} className="flex min-w-0 items-center gap-2">
            <UserAvatar user={story.author} size={32} ring={false} />
            <span className="truncate text-14 font-semibold text-white">
              {story.author.userName}
            </span>
          </Link>
          <span className="text-14 text-white/70">{timeAgo(story.createdAt)}</span>
          <span className="flex-1" />
          <button
            type="button"
            aria-label={userPaused ? 'Воспроизвести' : 'Пауза'}
            onClick={() => setUserPaused(!userPaused)}
            className={iconBtn}
          >
            {userPaused ? <Play className="size-5" /> : <Pause className="size-5" />}
          </button>
          {isVideo && (
            <button
              type="button"
              aria-label={muted ? 'Включить звук' : 'Выключить звук'}
              onClick={() => setMuted(!muted)}
              className={iconBtn}
            >
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
          )}
          {isOwn && (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger aria-label="Ещё" className={iconBtn}>
                <MoreHorizontal className="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {highlight ? (
                  <>
                    <DropdownMenuItem onSelect={() => setDialog('rename')}>
                      Изменить актуальное
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        run(async () => {
                          const rest = stories.filter((s) => s.id !== story.id).map((s) => s.id);
                          await setHighlightStories({
                            highlightId: highlight.id,
                            storyIds: rest,
                          }).unwrap();
                          toast.success('Удалено из актуального');
                        })
                      }
                    >
                      Удалить из актуального
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-badge"
                      onSelect={() => setDialog('deleteHighlight')}
                    >
                      Удалить актуальное
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem className="text-badge" onSelect={() => setDialog('delete')}>
                      Удалить
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDialog('addHighlight')}>
                      Добавить в актуальное
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Низ: просмотры (своя) или ответ, реакции, лайк, «Поделиться» (чужая) */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 bg-gradient-to-t from-black/50 to-transparent px-4 pt-8 pb-4"
        onFocus={() => !isOwn && setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
        }}
      >
        {isOwn ? (
          <button
            type="button"
            onClick={() => setDialog('viewers')}
            className="flex items-center gap-2 self-start text-14 font-semibold text-white"
          >
            <Eye className="size-5" />
            Просмотры: {story.viewerCount ?? 0}
          </button>
        ) : (
          <>
            {focused && (
              <div className="flex justify-between" aria-label="Быстрые реакции">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`Отправить реакцию ${emoji}`}
                    onClick={() => sendReaction(emoji)}
                    className="text-24 transition-transform hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={sendReply} className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label={`Ответьте пользователю ${story.author.userName}`}
                placeholder={`Ответьте пользователю ${story.author.userName}…`}
                className="h-11 min-w-0 flex-1 rounded-[22px] border border-white/60 bg-transparent px-4 text-14 text-white outline-none placeholder:text-white/70 focus:border-white"
              />
              {text.trim() ? (
                <button
                  type="submit"
                  disabled={replying}
                  className="text-14 font-semibold text-white disabled:opacity-50"
                >
                  Отправить
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    aria-label={liked ? 'Не нравится' : 'Нравится'}
                    aria-pressed={liked}
                    onClick={toggleLike}
                    className={iconBtn}
                  >
                    <Heart className={cn('size-6', liked && 'fill-badge text-badge')} />
                  </button>
                  <button type="button" aria-label="Поделиться" onClick={share} className={iconBtn}>
                    <Send className="size-6" />
                  </button>
                </>
              )}
            </form>
          </>
        )}
      </div>

      {/* Окна */}
      {dialog === 'viewers' && (
        <ViewersDialog storyId={story.id} open onOpenChange={(o) => !o && setDialog(null)} />
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title="Удалить историю?"
          confirmLabel="Удалить"
          onConfirm={() =>
            run(async () => {
              await deleteStory(story.id).unwrap();
              toast.success('История удалена');
            })
          }
        />
      )}
      {dialog === 'addHighlight' && (
        <CreateHighlightDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          initialStoryIds={[story.id]}
        />
      )}
      {dialog === 'rename' && highlight && (
        <RenameDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          initialTitle={highlight.title}
          onSave={(title) =>
            run(() => updateHighlight({ highlightId: highlight.id, title }).unwrap())
          }
        />
      )}
      {dialog === 'deleteHighlight' && highlight && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title="Удалить актуальное?"
          confirmLabel="Удалить"
          onConfirm={() =>
            run(async () => {
              await deleteHighlight(highlight.id).unwrap();
              onClose();
            })
          }
        />
      )}
    </div>
  );
}
