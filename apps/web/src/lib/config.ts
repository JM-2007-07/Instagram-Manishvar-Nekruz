// Название — только из NEXT_PUBLIC_APP_NAME (Q31; в .env.example — рабочее «Photogram»).
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Photogram';

// Файлы логотипа из public/brand/ — их находит next.config.ts при запуске; пустая строка — файла нет.
export const BRAND_LOGO_URL = process.env.NEXT_PUBLIC_BRAND_LOGO || null;
export const BRAND_MARK_URL = process.env.NEXT_PUBLIC_BRAND_MARK || null;
