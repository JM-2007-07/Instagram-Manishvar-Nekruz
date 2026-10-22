import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadMedia } from './upload';

type ProgressEvent = { lengthComputable: boolean; loaded: number; total: number };

// Заглушка XMLHttpRequest: запоминает вызовы, ответ "приходит" вручную через onload/onerror.
class FakeXhr {
  static last: FakeXhr;
  method = '';
  url = '';
  withCredentials = false;
  responseType = '';
  status = 0;
  response: unknown = null;
  body: unknown;
  upload: { onprogress?: (e: ProgressEvent) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  send(body: unknown) {
    this.body = body;
  }
}

describe('uploadMedia', () => {
  beforeEach(() => vi.stubGlobal('XMLHttpRequest', FakeXhr));
  afterEach(() => vi.unstubAllGlobals());

  it('шлёт POST /api/v1/media с cookie и полями file/purpose', () => {
    void uploadMedia(new Blob(['x'], { type: 'image/png' }), 'POST');
    const xhr = FakeXhr.last;
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/api/v1/media');
    expect(xhr.withCredentials).toBe(true);
    const body = xhr.body as FormData;
    expect(body.get('purpose')).toBe('POST');
    expect(body.get('file')).toBeInstanceOf(Blob);
  });

  it('сообщает прогресс в процентах', () => {
    const onProgress = vi.fn();
    void uploadMedia(new Blob(['x']), 'AVATAR', onProgress);
    FakeXhr.last.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 });
    FakeXhr.last.upload.onprogress?.({ lengthComputable: false, loaded: 0, total: 0 });
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(25);
  });

  it('2xx: возвращает тело ответа', async () => {
    const promise = uploadMedia(new Blob(['x']), 'POST');
    FakeXhr.last.status = 201;
    FakeXhr.last.response = { id: 'm1' };
    FakeXhr.last.onload?.();
    await expect(promise).resolves.toEqual({ id: 'm1' });
  });

  it('4xx: отклоняет с {status, data}', async () => {
    const promise = uploadMedia(new Blob(['x']), 'POST');
    const data = { statusCode: 413, code: 'PAYLOAD_TOO_LARGE', message: 'x' };
    FakeXhr.last.status = 413;
    FakeXhr.last.response = data;
    FakeXhr.last.onload?.();
    await expect(promise).rejects.toEqual({ status: 413, data });
  });

  it('сетевая ошибка: отклоняет с FETCH_ERROR', async () => {
    const promise = uploadMedia(new Blob(['x']), 'POST');
    FakeXhr.last.onerror?.();
    await expect(promise).rejects.toMatchObject({ status: 'FETCH_ERROR' });
  });
});
