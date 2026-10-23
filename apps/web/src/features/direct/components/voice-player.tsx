'use client';

import { useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

const clock = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Голосовое сообщение: кнопка «▶/❚❚», полоса прогресса (клик — перемотка) и время, как в Instagram. */
export function VoicePlayer({ src, durationSec }: { src: string; durationSec?: number | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationSec ?? 0);

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audio.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  const progress = duration ? Math.min(100, (current / duration) * 100) : 0;
  return (
    <div className="flex w-56 items-center gap-3 py-1" aria-label="Голосовое сообщение">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration);
        }}
      />
      <button
        type="button"
        aria-label={playing ? 'Пауза' : 'Слушать'}
        onClick={toggle}
        className="flex size-8 shrink-0 items-center justify-center"
      >
        {playing ? (
          <Pause className="size-5 fill-current" />
        ) : (
          <Play className="size-5 fill-current" />
        )}
      </button>
      <div
        role="slider"
        aria-label="Перемотка"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(current)}
        tabIndex={-1}
        onClick={seek}
        className="relative h-1 flex-1 cursor-pointer rounded-full bg-current/30"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-current"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="shrink-0 text-12 tabular-nums">
        {clock(playing || current ? current : duration)}
      </span>
    </div>
  );
}
