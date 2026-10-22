import type { MediaKind, MediaPurpose } from '@/generated/prisma/client';

const MB = 1024 * 1024;

// Лимиты загрузки по назначению (SECURITY.md «Загрузка файлов»). Значения помечены 📝 — это решения по умолчанию.
interface PurposeRule {
  kinds: MediaKind[]; // какие виды файлов разрешены
  maxBytes: Partial<Record<MediaKind, number>>;
  maxDurationSec?: number; // для видео и аудио
}

export const PURPOSE_RULES: Record<MediaPurpose, PurposeRule> = {
  POST: {
    kinds: ['IMAGE', 'VIDEO'],
    maxBytes: { IMAGE: 30 * MB, VIDEO: 650 * MB },
    maxDurationSec: 60 * 60,
  },
  REEL: { kinds: ['VIDEO'], maxBytes: { VIDEO: 650 * MB }, maxDurationSec: 3 * 60 },
  STORY: {
    kinds: ['IMAGE', 'VIDEO'],
    maxBytes: { IMAGE: 30 * MB, VIDEO: 250 * MB },
    maxDurationSec: 60,
  },
  AVATAR: { kinds: ['IMAGE'], maxBytes: { IMAGE: 10 * MB } },
  MESSAGE: {
    kinds: ['IMAGE', 'VIDEO'],
    maxBytes: { IMAGE: 30 * MB, VIDEO: 650 * MB },
    maxDurationSec: 60 * 60,
  },
  VOICE: { kinds: ['AUDIO'], maxBytes: { AUDIO: 10 * MB }, maxDurationSec: 60 },
  HIGHLIGHT_COVER: { kinds: ['IMAGE'], maxBytes: { IMAGE: 10 * MB } },
};

// Самый большой размер среди всех назначений: ограничение multer при приёме (точный лимит проверяется потом).
export const MAX_UPLOAD_BYTES = 650 * MB;

export type Container = 'jpeg' | 'png' | 'webp' | 'mp4' | 'webm' | 'ogg';

// Бренды ISO-контейнера, которые означают HEIC/AVIF-картинку, а не видео. Их sharp без патентных кодеков не читает.
const IMAGE_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'mif1',
  'msf1',
  'avif',
  'avis',
]);

// Определяет формат по первым байтам файла (сигнатуре), а не по расширению и не по заголовку клиента.
// null — формат не поддерживается (в том числе SVG, HTML, GIF, HEIC).
export function sniffContainer(head: Buffer): Container | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (
    head.length >= 8 &&
    head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (
    head.length >= 12 &&
    head.toString('latin1', 0, 4) === 'RIFF' &&
    head.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  if (head.length >= 12 && head.toString('latin1', 4, 8) === 'ftyp') {
    return IMAGE_BRANDS.has(head.toString('latin1', 8, 12)) ? null : 'mp4';
  }
  if (
    head.length >= 4 &&
    head[0] === 0x1a &&
    head[1] === 0x45 &&
    head[2] === 0xdf &&
    head[3] === 0xa3
  )
    return 'webm';
  if (head.length >= 4 && head.toString('latin1', 0, 4) === 'OggS') return 'ogg';
  return null;
}

export function isImageContainer(c: Container): boolean {
  return c === 'jpeg' || c === 'png' || c === 'webp';
}
