// Название и знак — как у Instagram (решение Студента A от 2026-10-23, учебный проект; ADR 0012, Q31).
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Instagram';

// Файлы логотипа из public/brand/ (logo.*, mark.*) находит next.config.ts при запуске; пустая строка — файла нет.
export const BRAND_LOGO_URL = process.env.NEXT_PUBLIC_BRAND_LOGO || null;
export const BRAND_MARK_URL = process.env.NEXT_PUBLIC_BRAND_MARK || null;
// Картинка слева на странице входа (необязательна) и картинка «нет фото».
export const AUTH_HERO_SRC = process.env.NEXT_PUBLIC_AUTH_HERO ?? '';
export const DEFAULT_AVATAR_SRC =
  process.env.NEXT_PUBLIC_DEFAULT_AVATAR ?? '/brand/default-avatar.jpg';
