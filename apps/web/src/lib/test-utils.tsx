// Помощники для тестов компонентов (Vitest + RTL). В код приложения не импортируется.
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { vi } from 'vitest';
import { makeStore } from './store';

/** Рендер с настоящим store RTK Query (запросы идут в замоканный fetch). */
export function renderWithStore(ui: React.ReactElement) {
  const store = makeStore();
  return { store, ...render(<Provider store={store}>{ui}</Provider>) };
}

type Route = { method?: string; path: string | RegExp; status?: number; body?: unknown };

/**
 * Подменяет fetch: первый подходящий маршрут отвечает JSON. Путь сравнивается без /api/v1 и query.
 * Неизвестный запрос → 404, чтобы тест не зависал. Возвращает vi.fn для проверки вызовов.
 */
export function mockFetch(routes: Route[]) {
  // В Node Request не принимает относительный URL — подставляем origin (как в base-api.test.ts).
  const NodeRequest = globalThis.Request;
  class TestRequest extends NodeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(typeof input === 'string' ? new URL(input, 'http://localhost').href : input, init);
    }
  }
  vi.stubGlobal('Request', TestRequest);

  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url, 'http://localhost');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = request.method.toUpperCase();
    const route = routes.find(
      (r) =>
        (r.method ?? 'GET').toUpperCase() === method &&
        (typeof r.path === 'string' ? r.path === path : r.path.test(path)),
    );
    const status = route ? (route.status ?? 200) : 404;
    const body = route ? route.body : { statusCode: 404, code: 'NOT_FOUND', message: 'Not found' };
    return new Response(status === 204 || body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
