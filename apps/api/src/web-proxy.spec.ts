import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { trustProxy } from './app.setup';
import { setupWebProxy } from './web-proxy';

describe('setupWebProxy', () => {
  let upstream: Server;
  let url: string;

  beforeAll(async () => {
    upstream = createServer((req, res) => res.end(`page ${req.url} host=${req.headers.host}`));
    await new Promise<void>((resolve) => upstream.listen(0, resolve));
    url = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => upstream.close(() => resolve())));

  // Мини-приложение: промежуточный обработчик прокси, а дальше «API» отвечает на /api/*, остальное — 404.
  function appWith(target: string | undefined) {
    type Handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
    const handlers: Handler[] = [];
    setupWebProxy({ use: (h: Handler) => handlers.push(h) } as unknown as INestApplication, target);
    return createServer((req, res) => {
      const api = () => {
        res.statusCode = req.url?.startsWith('/api/') ? 200 : 404;
        res.end(res.statusCode === 200 ? 'api' : 'not found');
      };
      if (handlers[0]) handlers[0](req, res, api);
      else api();
    });
  }

  it('страницы уходят в Next.js, /api/* остаётся в API', async () => {
    const server = appWith(url);
    const page = await request(server).get('/alice/');
    expect(page.text).toContain('page /alice/');
    expect(page.text).toContain(`host=127.0.0.1`); // changeOrigin: хост сервиса Next.js
    expect((await request(server).get('/api/v1/health')).text).toBe('api');
  });

  it('без WEB_UPSTREAM_URL ничего не пересылает', async () => {
    expect((await request(appWith(undefined)).get('/alice/')).status).toBe(404);
  });
});

describe('trustProxy', () => {
  it('по умолчанию — только локальный прокси; true и число — как в express', () => {
    expect(trustProxy(undefined)).toBe('loopback');
    expect(trustProxy('true')).toBe(true);
    expect(trustProxy('2')).toBe(2);
  });
});
