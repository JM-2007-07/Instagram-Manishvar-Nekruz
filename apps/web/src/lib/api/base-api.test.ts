import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '../store';
import { baseApi } from './base-api';

const api = baseApi.injectEndpoints({
  endpoints: (build) => ({
    ping: build.query<{ ok: boolean }, void>({ query: () => '/ping' }),
  }),
});

// В Node Request не принимает относительный URL (в браузере он считается от origin страницы).
// Подставляем origin сами, чтобы fetchBaseQuery с baseUrl '/api/v1' работал в тесте.
const NodeRequest = globalThis.Request;
class TestRequest extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(typeof input === 'string' ? new URL(input, 'http://localhost').href : input, init);
  }
}

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn<(request: Request) => Promise<Response>>(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const unauthenticated = { statusCode: 401, code: 'UNAUTHENTICATED', message: 'x' };

describe('baseQueryWithAuth', () => {
  const assign = vi.fn();

  function setPath(pathname: string) {
    vi.stubGlobal('location', { pathname, assign });
  }

  beforeEach(() => {
    assign.mockClear();
    vi.stubGlobal('Request', TestRequest);
    setPath('/');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('200: возвращает данные', async () => {
    respond(200, { ok: true });
    const result = await makeStore().dispatch(api.endpoints.ping.initiate());
    expect(result.data).toEqual({ ok: true });
    expect(assign).not.toHaveBeenCalled();
  });

  it('запрос идёт на /api/v1 с credentials same-origin', async () => {
    const fetchMock = respond(200, { ok: true });
    await makeStore().dispatch(api.endpoints.ping.initiate());
    const request = fetchMock.mock.calls[0][0];
    expect(new URL(request.url, 'http://localhost').pathname).toBe('/api/v1/ping');
    expect(request.credentials).toBe('same-origin');
  });

  it('401 UNAUTHENTICATED: переход на страницу входа', async () => {
    respond(401, unauthenticated);
    // Кэш RTK Query при этом сбрасывается (resetApiState), поэтому result.error пуст — проверяем переход.
    await makeStore().dispatch(api.endpoints.ping.initiate());
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/accounts/login/');
  });

  it('401 UNAUTHENTICATED на странице входа: перехода нет', async () => {
    setPath('/accounts/login/');
    respond(401, unauthenticated);
    await makeStore().dispatch(api.endpoints.ping.initiate());
    expect(assign).not.toHaveBeenCalled();
  });

  it('401 INVALID_CREDENTIALS: перехода нет', async () => {
    respond(401, { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'x' });
    const result = await makeStore().dispatch(api.endpoints.ping.initiate());
    expect(result.error).toMatchObject({ status: 401 });
    expect(assign).not.toHaveBeenCalled();
  });
});
