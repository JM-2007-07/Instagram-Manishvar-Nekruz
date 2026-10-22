'use client';

import { useRef, useState } from 'react';
import { Heart, ImageIcon, Mic, Send, Smile, Square, X } from 'lucide-react';
import { toast } from 'sonner';
import { showApiError } from '@/lib/api/errors';
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
  const [sendMessage] = useSendMessageMutation();
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const lastTyping = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        Array.from(files).map((file) => uploadMedia(file, 'MESSAGE') as Promise<MediaItem>),
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const media = new MediaRecorder(stream);
      recorder.current = media;
      media.ondataavailable = (e) => chunks.push(e.data);
      media.onstop = () => {
        for (const track of stream.getTracks()) track.stop();
        setIsRecording(false);
        const blob = new Blob(chunks, { type: media.mimeType || 'audio/webm' });
        void sendVoice(blob);
      };
      media.start();
      setIsRecording(true);
      setTimeout(() => media.state === 'recording' && media.stop(), MAX_VOICE_SEC * 1000);
    } catch {
      toast.error('Нет доступа к микрофону');
    }
  }

  async function sendVoice(blob: Blob) {
    if (blob.size === 0) return;
    setIsUploading(true);
    try {
      const item = (await uploadMedia(blob, 'VOICE')) as MediaItem;
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

      {emojiOpen && (
        <div className="mb-1 flex flex-wrap gap-1 rounded-2xl border border-border bg-background-elevated p-2">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Вставить ${emoji}`}
              className="rounded px-1 text-20 hover:bg-hover-overlay"
              onClick={() => setText((value) => value + emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5"
      >
        <button type="button" aria-label="Эмодзи" onClick={() => setEmojiOpen((v) => !v)}>
          <Smile className="size-6" />
        </button>

        {isRecording ? (
          <span className="flex-1 text-14 text-destructive" role="status">
            Идёт запись…
          </span>
        ) : (
          <input
            aria-label="Сообщение"
            placeholder="Сообщение…"
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            maxLength={2000}
            className="min-w-0 flex-1 bg-transparent py-1 text-14 outline-none"
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
              <button
                type="button"
                aria-label="Остановить запись"
                onClick={() => recorder.current?.stop()}
              >
                <Square className="size-6 text-destructive" />
              </button>
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
      {isUploading && <p className="px-4 pt-1 text-12 text-muted-foreground">Отправка…</p>}
    </div>
  );
}
