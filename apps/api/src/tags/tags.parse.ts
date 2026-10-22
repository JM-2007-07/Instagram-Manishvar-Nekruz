import { USER_NAME_REGEX } from '@/auth/auth.rules';

export const MAX_HASHTAG_LENGTH = 100;
export const MAX_HASHTAGS = 30;
export const MAX_MENTIONS = 20;

export interface ParsedTags {
  hashtags: string[];
  mentions: string[];
}

export interface ParseLimits {
  maxHashtags?: number;
  maxMentions?: number;
}

// «#» не должен стоять сразу после буквы, цифры, «_», «#», «&» (так отсекаем «abc#def», «&#39;»).
const HASHTAG_REGEX = /(?<![\p{L}\p{N}_#&])#([\p{L}\p{N}_]+)/gu;
// «@» не должен стоять после буквы, цифры, «_», «.», «@» (так отсекаем адреса почты).
const MENTION_REGEX = /(?<![\p{L}\p{N}_.@])@([A-Za-z0-9._]+)/gu;

// Чистая функция: хэштеги и упоминания из текста. Нижний регистр, без дубликатов, в порядке появления.
export function parseTags(text: string, limits: ParseLimits = {}): ParsedTags {
  const maxHashtags = limits.maxHashtags ?? MAX_HASHTAGS;
  const maxMentions = limits.maxMentions ?? MAX_MENTIONS;

  const hashtags = new Set<string>();
  for (const match of text.matchAll(HASHTAG_REGEX)) {
    const name = match[1].toLowerCase();
    if (name.length > MAX_HASHTAG_LENGTH) continue;
    hashtags.add(name);
  }

  const mentions = new Set<string>();
  for (const match of text.matchAll(MENTION_REGEX)) {
    const name = match[1].toLowerCase().replace(/\.+$/, ''); // точка в конце — знак препинания
    if (!USER_NAME_REGEX.test(name)) continue;
    mentions.add(name);
  }

  return {
    hashtags: [...hashtags].slice(0, maxHashtags),
    mentions: [...mentions].slice(0, maxMentions),
  };
}
