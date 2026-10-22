// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { config, proxy } from './proxy';

function run(path: string, cookie?: string) {
  const request = new NextRequest(`http://localhost${path}`, {
    headers: cookie ? { cookie } : {},
  });
  return proxy(request);
}

describe('proxy', () => {
  it('отправляет гостя с / на страницу входа', () => {
    const response = run('/');
    expect([307, 308]).toContain(response.status);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/accounts/login/');
  });

  it('отправляет гостя с /accounts/edit/ на страницу входа', () => {
    const response = run('/accounts/edit/');
    expect([307, 308]).toContain(response.status);
    expect(response.headers.get('location')).toContain('/accounts/login/');
  });

  it.each(['sid=x', '__Host-sid=x'])('пропускает запрос с cookie %s', (cookie) => {
    expect(run('/', cookie).headers.get('location')).toBeNull();
  });

  it.each(['/accounts/login/', '/accounts/login', '/accounts/emailsignup/'])(
    'пропускает гостя на публичный путь %s',
    (path) => {
      expect(run(path).headers.get('location')).toBeNull();
    },
  );

  describe('config.matcher', () => {
    const regex = new RegExp(`^${config.matcher[0]}$`);

    it('не охватывает API и статику Next', () => {
      expect(regex.test('/api/v1/me')).toBe(false);
      expect(regex.test('/_next/static/x.js')).toBe(false);
    });

    it('охватывает обычные страницы', () => {
      expect(regex.test('/')).toBe(true);
      expect(regex.test('/accounts/edit/')).toBe(true);
    });
  });
});
