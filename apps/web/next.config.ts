import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

// Логотип для показа: файлы в public/brand/ (папка в .gitignore — официальные знаки в репозиторий не кладём).
// logo — полный логотип, mark — знак для свёрнутого меню и заставки. Нет файла — текстовый логотип.
// Проверяется при запуске: после добавления файла перезапустите `npm run dev`.
function brandFile(name: string) {
  const file = ['svg', 'png']
    .map((ext) => `${name}.${ext}`)
    .find((f) => fs.existsSync(path.join(process.cwd(), 'public', 'brand', f)));
  return file ? `/brand/${file}` : '';
}

// Адрес NestJS виден только серверу Next.js, в браузер не попадает (ADR 0004).
const apiInternalUrl = process.env.API_INTERNAL_URL;

if (!apiInternalUrl) {
  // Не ошибка: typecheck и lint (локально и в CI) читают конфиг без .env.local.
  console.warn(
    'API_INTERNAL_URL is not set: /api/* will not be proxied. See apps/web/.env.example.',
  );
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BRAND_LOGO: brandFile('logo'),
    NEXT_PUBLIC_BRAND_MARK: brandFile('mark'),
  },
  experimental: {
    // Тело загрузки (до 600 МБ) проходит через proxy.ts; по умолчанию Next обрезает его до 10 МБ.
    proxyClientMaxBodySize: '700mb',
    proxyTimeout: 10 * 60 * 1000,
  },
  // Браузер ходит на свой origin /api/*, Next.js проксирует запрос в NestJS:
  // так cookie сессии остаётся same-origin.
  async rewrites() {
    if (!apiInternalUrl) return [];
    return [{ source: '/api/:path*', destination: `${apiInternalUrl}/api/:path*` }];
  },
};

export default nextConfig;
