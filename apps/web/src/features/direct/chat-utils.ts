import type { Chat, Message } from '@/lib/api/types';

export const MAX_EDIT_MINUTES = 15; // окно правки сообщения (chats.md)
export const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

/** Собеседник личного чата (не я). */
export function getPeer(chat: Chat, meId: string) {
  return chat.participants.find((p) => p.id !== meId) ?? chat.participants[0];
}

export function getChatTitle(chat: Chat, meId: string): string {
  if (chat.type === 'GROUP') {
    if (chat.title) return chat.title;
    const names = chat.participants.filter((p) => p.id !== meId).map((p) => p.userName);
    return names.join(', ') || 'Группа';
  }
  return getPeer(chat, meId)?.userName ?? 'Чат';
}

export function getChatAvatarUrl(chat: Chat, meId: string): string | null {
  if (chat.type === 'GROUP') return chat.avatarUrl;
  return getPeer(chat, meId)?.avatarUrl ?? chat.avatarUrl;
}

/** Текст «последнего сообщения» для списка чатов. */
export function getMessagePreview(message: Message | null, meId: string): string {
  if (!message) return 'Нет сообщений';
  const prefix = message.sender?.id === meId ? 'Вы: ' : '';
  switch (message.type) {
    case 'MEDIA':
      return `${prefix}${message.text || 'Вложение'}`;
    case 'VOICE':
      return `${prefix}Голосовое сообщение`;
    case 'SHARE_POST':
      return `${prefix}Поделился публикацией`;
    case 'SHARE_PROFILE':
      return `${prefix}Поделился профилем`;
    case 'SHARE_STORY':
    case 'STORY_REPLY':
    case 'STORY_REACTION':
      return `${prefix}История`;
    case 'CALL':
      return message.call?.type === 'VIDEO' ? 'Видеозвонок' : 'Аудиозвонок';
    default:
      return `${prefix}${message.text ?? ''}`;
  }
}

/** Короткое время для списка: «сейчас», «5 мин», «3 ч», «вт», «12.03». */
export function formatShortTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return 'сейчас';
  if (diffMin < 60) return `${diffMin} мин`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)} ч`;
  if (diffMin < 60 * 24 * 7) return date.toLocaleDateString('ru-RU', { weekday: 'short' });
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function canEdit(message: Message, meId: string, now: number = Date.now()): boolean {
  return (
    message.sender?.id === meId &&
    message.type === 'TEXT' &&
    now - new Date(message.createdAt).getTime() < MAX_EDIT_MINUTES * 60000
  );
}

/** Новые сообщения сначала → хронологический порядок и группы подряд идущих от одного автора. */
export type MessageGroup = { key: string; senderId: string | null; messages: Message[] };

const GROUP_GAP_MS = 5 * 60000;

export function groupMessages(newestFirst: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of [...newestFirst].reverse()) {
    const last = groups[groups.length - 1];
    const prev = last?.messages[last.messages.length - 1];
    const senderId = message.sender?.id ?? null;
    const isSystem = message.type === 'SYSTEM' || message.type === 'CALL';
    const sameGroup =
      last &&
      prev &&
      !isSystem &&
      prev.type !== 'SYSTEM' &&
      prev.type !== 'CALL' &&
      last.senderId === senderId &&
      new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_GAP_MS;
    if (sameGroup) last.messages.push(message);
    else groups.push({ key: message.id, senderId, messages: [message] });
  }
  return groups;
}

/** Временный Message для оптимистичного показа (id начинается с «tmp-»). */
export function makeOptimisticMessage(
  chatId: string,
  sender: Message['sender'],
  clientId: string,
  partial: Partial<Message>,
): Message {
  return {
    id: `tmp-${clientId}`,
    chatId,
    sender,
    type: 'TEXT',
    text: null,
    clientId,
    media: [],
    replyTo: null,
    sharedPost: null,
    sharedUser: null,
    storyId: null,
    story: null,
    call: null,
    systemData: null,
    reactions: [],
    editedAt: null,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

export const isTemp = (message: Message) => message.id.startsWith('tmp-');
