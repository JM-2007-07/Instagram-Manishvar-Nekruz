'use client';

import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Heart, ImageIcon, Mic, Send, Smile, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { waitForMediaReady } from '@/features/create-post/api';
import { showApiError } from '@/lib/api/errors';
import type { AppDispatch } from '@/lib/store';
import type { MediaItem, Message, UserSummary } from '@/lib/api/types';
import { uploadMedia } from '@/lib/api/upload';
import { useSendMessageMutation } from '../api';
import { makeOptimisticMessage } from '../chat-utils';

const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '👍', '🙏', '🎉', '🔥', '❤️', '💔'];
const MAX_VOICE_SEC = 60;
const TYPING_THROTTLE_MS = 2000;

export function MessageComposer({
  chatId,
  me,
  replyTo,
  onClearReply,
  onTyping,
}: {
  chatId: string;
  me: UserSummary;
  replyTo: Message | null;
  onClearReply: () => void;
  onTyping: (isTyping: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [sendMessage] = useSendMessageMutation();
  const dispatch = useDispatch<AppDispatch>();
  const fileInput = useRef<HTMLInputElement>(null);
  const emojiBox = useRef<HTMLDivElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const cancelled = useRef(false);
  const lastTyping = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Эмодзи-панель закрывается по Escape и по клику мимо неё (кнопка «Эмодзи» внутри emojiBox).
  useEffect(() => {
    if (!emojiOpen) return;
    function onPointer(e: PointerEvent) {
      if (!emojiBox.current?.contains(e.target as Node)) setEmojiOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setEmojiOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [emojiOpen]);

  // Секундомер записи; на 60 с запись останавливается и отправляется сама (лимит API).
  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => setRecordSec((sec) => sec + 1), 1000);
    return () => clearInterval(timer);
  }, [isRecording]);
  useEffect(() => {
    if (isRecording && recordSec >= MAX_VOICE_SEC) recorder.current?.stop();
  }, [isRecording, recordSec]);

  // Уход со страницы во время записи — выключаем микрофон, ничего не отправляем.
  useEffect(
    () => () => {
      cancelled.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
    },
    [],
  );

  async function send(
    body: { type: 'TEXT' | 'MEDIA' | 'VOICE'; text?: string; mediaIds?: string[] },
    optimistic: boolean,
  ) {
    const clientId = crypto.randomUUID();
    const message = optimistic
      ? makeOptimisticMessage(chatId, me, clientId, {
          type: body.type,
          text: body.text ?? null,
          replyTo: replyTo
            ? { id: replyTo.id, text: replyTo.text, senderName: replyTo.sender?.userName ?? '' }
            : null,
        })
      : undefined;
    try {
      await sendMessage({
        chatId,
        body: { ...body, clientId, replyToId: replyTo?.id },
        optimistic: message,
      }).unwrap();
      onClearReply();
    } catch (error) {
      showApiError(error);
    }
  }

  function handleChange(value: string) {
    setText(value);
    // «Печатает…»: не чаще раза в 2 с; через 3 с тишины — «перестал».
    const now = Date.now();
    if (now - lastTyping.current > TYPING_THROTTLE_MS) {
      lastTyping.current = now;
      onTyping(true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      lastTyping.current = 0;
      onTyping(false);
    }, 3000);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    setEmojiOpen(false);
    onTyping(false);
    await send({ type: 'TEXT', text: value }, true);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => {
          const item = (await uploadMedia(file, 'MESSAGE')) as MediaItem;
          // Видео сервер обрабатывает (ffmpeg); прикрепить можно только готовый файл.
          if (item.status === 'PROCESSING') await waitForMediaReady(dispatch, item.id);
          return item;
        }),
      );
      await send({ type: 'MEDIA', mediaIds: uploaded.map((m) => m.id) }, false);
    } catch (error) {
      showApiError(error);
    } finally {
      setIsUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function startRecording() {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Браузер не поддерживает запись голоса');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error('Нет доступа к микрофону. Разрешите его в настройках браузера.');
      return;
    }
    const chunks: Blob[] = [];
    const media = new MediaRecorder(stream);
    recorder.current = media;
    cancelled.current = false;
    media.ondataavailable = (e) => chunks.push(e.data);
    media.onstop = () => {
      for (const track of stream.getTracks()) track.stop();
      setIsRecording(false);
      recorder.current = null;
      if (cancelled.current) return;
      void sendVoice(new Blob(chunks, { type: media.mimeType || 'audio/webm' }));
    };
    media.start();
    setEmojiOpen(false);
    setRecordSec(0);
    setIsRecording(true);
  }

  function cancelRecording() {
    cancelled.current = true;
    recorder.current?.stop();
  }

  async function sendVoice(blob: Blob) {
    if (blob.size === 0) return;
    setIsUploading(true);
    try {
      const item = (await uploadMedia(blob, 'VOICE')) as MediaItem;
      // Аудио сервер переводит в общий формат (ffmpeg) — ждём READY, иначе API не примет файл.
      if (item.status === 'PROCESSING') await waitForMediaReady(dispatch, item.id);
      await send({ type: 'VOICE', mediaIds: [item.id] }, false);
    } catch (error) {
      showApiError(error);
    } finally {
      setIsUploading(false);
    }
  }

  const hasText = text.trim().length > 0;

  return (
    <div className="shrink-0 px-4 pb-4">
      {replyTo && (
        <div className="mb-1 flex items-center justify-between rounded-t-2xl bg-muted px-4 py-2 text-12">
          <span className="truncate">
            Ответ для <b>{replyTo.sender?.userName}</b>: {replyTo.text ?? 'Вложение'}
          </span>
          <button type="button" aria-label="Отменить ответ" onClick={onClearReply}>
            <X className="size-4" />
          </button>
        </div>
      )}

      <div ref={emojiBox}>
        {emojiOpen && (
          <div
            role="dialog"
            aria-label="Эмодзи"
            className="mb-1 flex flex-wrap gap-1 rounded-2xl border border-border bg-background-elevated p-2"
          >
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Вставить ${emoji}`}
                className="rounded px-1 text-20 hover:bg-hover-overlay"
                onClick={() => {
                  setText((value) => value + emoji);
                  setEmojiOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex min-h-11 items-center gap-3 rounded-[22px] border-[0.8px] border-separator px-[11px]"
        >
          <button
            type="button"
            aria-label="Эмодзи"
            aria-expanded={emojiOpen}
            disabled={isRecording}
            onClick={() => setEmojiOpen((v) => !v)}
          >
            <Smile className="size-6" />
          </button>

          {isRecording ? (
            <span className="flex flex-1 items-center gap-2 text-14" role="status">
              <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
              Запись {Math.floor(recordSec / 60)}:{String(recordSec % 60).padStart(2, '0')}
            </span>
          ) : (
            <input
              aria-label="Сообщение"
              placeholder="Напишите сообщение…"
              value={text}
              onChange={(e) => handleChange(e.target.value)}
              maxLength={2000}
              className="min-w-0 flex-1 bg-transparent py-3 text-15 leading-[18px] outline-none placeholder:text-icon-secondary"
            />
          )}

          {hasText ? (
            <button
              type="submit"
              aria-label="Отправить"
              className="text-14 font-semibold text-primary"
            >
              <Send className="size-6" />
            </button>
          ) : (
            <>
              {isRecording ? (
                <>
                  <button type="button" aria-label="Отменить запись" onClick={cancelRecording}>
                    <Trash2 className="size-6 text-destructive" />
                  </button>
                  <button
                    type="button"
                    aria-label="Отправить голосовое"
                    className="text-primary"
                    onClick={() => recorder.current?.stop()}
                  >
                    <Send className="size-6" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  aria-label="Голосовое сообщение"
                  disabled={isUploading}
                  onClick={() => void startRecording()}
                >
                  <Mic className="size-6" />
                </button>
              )}
              <button
                type="button"
                aria-label="Фото или видео"
                disabled={isUploading}
                onClick={() => fileInput.current?.click()}
              >
                <ImageIcon className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Отправить сердце"
                onClick={() => void send({ type: 'TEXT', text: '❤️' }, true)}
              >
                <Heart className="size-6" />
              </button>
            </>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            aria-label="Выбрать файлы"
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </form>
      </div>
      {isUploading && <p className="px-4 pt-1 text-12 text-muted-foreground">Отправка…</p>}
    </div>
  );
}
