// Название и знак — как у Instagram (решение Студента A от 2026-10-23, учебный проект; ADR 0012, Q31).
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Instagram';

// Картинки бренда лежат в public/brand/; пути можно переопределить в apps/web/.env.local.
// Пустая строка — показать свой знак и название текстом.
export const BRAND_MARK_SRC = process.env.NEXT_PUBLIC_BRAND_MARK ?? '/brand/mark.png';
export const BRAND_WORDMARK_SRC = process.env.NEXT_PUBLIC_BRAND_WORDMARK ?? '';
export const AUTH_HERO_SRC = process.env.NEXT_PUBLIC_AUTH_HERO ?? '';
export const DEFAULT_AVATAR_SRC =
  process.env.NEXT_PUBLIC_DEFAULT_AVATAR ?? '/brand/default-avatar.jpg';
