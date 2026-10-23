// Q31 открыт: название рабочее. Слово «Instagram» в интерфейсе не используется.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Photogram';

// Картинки бренда для локального показа (ADR 0012): файлы лежат в public/brand/ (папка в .gitignore),
// пути задаются только в apps/web/.env.local. Без них показываем свой знак и название текстом.
export const BRAND_MARK_SRC = process.env.NEXT_PUBLIC_BRAND_MARK ?? '';
export const BRAND_WORDMARK_SRC = process.env.NEXT_PUBLIC_BRAND_WORDMARK ?? '';
export const AUTH_HERO_SRC = process.env.NEXT_PUBLIC_AUTH_HERO ?? '';
export const DEFAULT_AVATAR_SRC = process.env.NEXT_PUBLIC_DEFAULT_AVATAR ?? '';
