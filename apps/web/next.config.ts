import type { NextConfig } from 'next';

// Адрес NestJS виден только серверу Next.js, в браузер не попадает (ADR 0004).
const apiInternalUrl = process.env.API_INTERNAL_URL;

if (!apiInternalUrl) {
  // Не ошибка: typecheck и lint (локально и в CI) читают конфиг без .env.local.
  console.warn(
    'API_INTERNAL_URL is not set: /api/* will not be proxied. See apps/web/.env.example.',
  );
}

const nextConfig: NextConfig = {
  // Браузер ходит на свой origin /api/*, Next.js проксирует запрос в NestJS:
  // так cookie сессии остаётся same-origin.
  async rewrites() {
    if (!apiInternalUrl) return [];
    return [{ source: '/api/:path*', destination: `${apiInternalUrl}/api/:path*` }];
  },
};

export default nextConfig;
