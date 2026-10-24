import type { INestApplication } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * Один публичный адрес на Render (ADR 0020): браузер ходит только на API, а API пересылает все
 * страницы (всё, кроме /api/* и /socket.io/*) в сервис Next.js по WEB_UPSTREAM_URL.
 * Так cookie сессии и Socket.IO работают на одном origin без своего домена.
 * Не задан WEB_UPSTREAM_URL (разработка, тесты) — ничего не делает.
 * Подключается до helmet: заголовки безопасности страниц ставит сам Next.js.
 */
export function setupWebProxy(app: INestApplication, upstream: string | undefined): void {
  if (!upstream) return;
  app.use(
    createProxyMiddleware({
      target: upstream,
      changeOrigin: true, // Render выбирает сервис по Host — нужен хост сервиса Next.js
      xfwd: true,
      pathFilter: (path) => !path.startsWith('/api/') && !path.startsWith('/socket.io'),
    }),
  );
}
