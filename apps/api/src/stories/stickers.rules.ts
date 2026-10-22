import { validationError } from '@/common/validation';
import type { Prisma } from '@/generated/prisma/client';
import type { StickerInputDto } from './dto/stories.dto';

// Чистые правила стикеров (без БД): проверка data при создании, проверка ответа зрителя и итоги.
// Что именно лежит в data — по типу стикера (см. описание StickerInputDto.data).

type Data = Record<string, unknown>;

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function text(data: Data, key: string, max: number, field: string): string {
  const value = data[key];
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw validationError(field, `${key} must be a non-empty string up to ${max} characters`);
  }
  return value.trim();
}

function options(data: Data, field: string): string[] {
  const value = data.options;
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    value.length > 4 ||
    value.some((o) => typeof o !== 'string' || o.trim().length === 0 || o.length > 80)
  ) {
    throw validationError(field, 'options must be 2-4 non-empty strings up to 80 characters');
  }
  return (value as string[]).map((o) => o.trim());
}

/** Оставляет в data только известные поля и проверяет их. Существование пользователя/места проверяет сервис. */
export function normalizeStickerData(
  sticker: StickerInputDto,
  index: number,
): Prisma.InputJsonObject {
  const field = `stickers.${index}.data`;
  const data = sticker.data;
  switch (sticker.type) {
    case 'MENTION':
      if (!isUuid(data.userId)) throw validationError(field, 'userId must be a UUID');
      return { userId: data.userId };
    case 'LOCATION':
      if (!isUuid(data.locationId)) throw validationError(field, 'locationId must be a UUID');
      return { locationId: data.locationId };
    case 'HASHTAG':
      return { tag: text(data, 'tag', 100, field).replace(/^#/, '').toLowerCase() };
    case 'LINK': {
      const url = text(data, 'url', 2048, field);
      if (!/^https?:\/\/\S+$/i.test(url))
        throw validationError(field, 'url must start with http(s)://');
      return { url };
    }
    case 'POLL':
      return { question: text(data, 'question', 200, field), options: options(data, field) };
    case 'QUESTION':
      return { prompt: text(data, 'prompt', 200, field) };
    case 'SLIDER': {
      const emoji = typeof data.emoji === 'string' && data.emoji.length <= 16 ? data.emoji : null;
      return { question: text(data, 'question', 200, field), emoji };
    }
    case 'QUIZ': {
      const list = options(data, field);
      const correct = data.correctIndex;
      if (
        !Number.isInteger(correct) ||
        (correct as number) < 0 ||
        (correct as number) >= list.length
      ) {
        throw validationError(field, 'correctIndex must point to one of options');
      }
      return {
        question: text(data, 'question', 200, field),
        options: list,
        correctIndex: correct as number,
      };
    }
    case 'COUNTDOWN': {
      const endsAt = new Date(String(data.endsAt));
      if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now()) {
        throw validationError(field, 'endsAt must be a future date');
      }
      return { title: text(data, 'title', 100, field), endsAt: endsAt.toISOString() };
    }
  }
}

export const INTERACTIVE_TYPES = ['POLL', 'QUESTION', 'SLIDER', 'QUIZ'] as const;

export function isInteractive(type: string): boolean {
  return (INTERACTIVE_TYPES as readonly string[]).includes(type);
}

/** Проверяет ответ зрителя: POLL/QUIZ — номер варианта, QUESTION — текст, SLIDER — число 0..1. */
export function parseStickerResponse(
  type: string,
  data: Data,
  value: unknown,
): Prisma.InputJsonValue {
  switch (type) {
    case 'POLL':
    case 'QUIZ': {
      const count = Array.isArray(data.options) ? data.options.length : 0;
      if (!Number.isInteger(value) || (value as number) < 0 || (value as number) >= count) {
        throw validationError('value', 'value must be the index of an option');
      }
      return value as number;
    }
    case 'QUESTION':
      if (typeof value !== 'string' || value.trim().length === 0 || value.length > 500) {
        throw validationError('value', 'value must be a non-empty string up to 500 characters');
      }
      return value.trim();
    case 'SLIDER':
      if (typeof value !== 'number' || !(value >= 0 && value <= 1)) {
        throw validationError('value', 'value must be a number from 0 to 1');
      }
      return value;
    default:
      throw validationError('stickerId', 'This sticker does not accept responses');
  }
}

/** Итоги для автора: POLL/QUIZ — сколько выбрали каждый вариант, SLIDER — среднее. */
export function summarizeResponses(
  type: string,
  data: Data,
  values: unknown[],
): Record<string, unknown> {
  if (type === 'POLL' || type === 'QUIZ') {
    const size = Array.isArray(data.options) ? data.options.length : 0;
    const counts = new Array<number>(size).fill(0);
    for (const v of values) if (typeof v === 'number' && counts[v] !== undefined) counts[v] += 1;
    return { counts };
  }
  if (type === 'SLIDER') {
    const nums = values.filter((v): v is number => typeof v === 'number');
    return { average: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null };
  }
  return {};
}
