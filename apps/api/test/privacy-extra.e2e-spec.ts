import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, createUser, loginAs, resetDb, withOrigin } from './helpers';
import type { TestUser } from './helpers';
import { resetThrottler } from './helpers/throttler';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Privacy: ограничение, скрытие, близкие друзья, избранное, скрыть историю от', () => {
  let app: INestApplication;
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  let cookie: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(app);
    resetThrottler(app);
    alice = await createUser(app, { userName: 'alice' });
    bob = await createUser(app, { userName: 'bob' });
    carol = await createUser(app, { userName: 'carol' });
    cookie = await loginAs(app, alice);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const get = (path: string, c: string | null = cookie) => {
    const req = http().get(`/api/v1${path}`);
    return c ? req.set('Cookie', c) : req;
  };
  const send = (method: 'put' | 'delete', path: string, c: string | null = cookie) => {
    const req = http()[method](`/api/v1${path}`).set(withOrigin());
    return c ? req.set('Cookie', c) : req;
  };
  const ids = (res: request.Response) =>
    (res.body as { items: { id: string }[] }).items.map((i) => i.id);

  it.each([
    ['restrict', 'users', 'me/restricted'],
    ['close-friends', 'me', 'me/close-friends'],
    ['story-hidden-from', 'me', 'me/story-hidden-from'],
  ])('%s: добавить, повторить, список, удалить', async (name, scope, listPath) => {
    const path = scope === 'users' ? `/users/${bob.id}/${name}` : `/me/${name}/${bob.id}`;
    await send('put', path).expect(204);
    await send('put', path).expect(204);
    expect(ids(await get(`/${listPath}`).expect(200))).toEqual([bob.id]);
    await send('delete', path).expect(204);
    expect(ids(await get(`/${listPath}`).expect(200))).toEqual([]);
  });

  it.each([
    '/users/SELF/restrict',
    '/users/SELF/mute',
    '/me/close-friends/SELF',
    '/me/story-hidden-from/SELF',
    '/me/favorite-accounts/SELF',
  ])('нельзя применить к себе (400): %s', async (template) => {
    await send('put', template.replace('SELF', alice.id))
      .send({ posts: true, stories: true })
      .expect(400);
  });

  it('несуществующий пользователь — 404, без сессии — 401', async () => {
    await send('put', `/users/${UNKNOWN_ID}/restrict`).expect(404);
    await send('put', `/me/close-friends/${UNKNOWN_ID}`).expect(404);
    await send('put', `/users/${bob.id}/restrict`, null).expect(401);
    await get('/me/restricted', null).expect(401);
  });

  it('заблокированного нельзя добавить в близкие друзья (404)', async () => {
    await send('put', `/users/${bob.id}/block`).expect(204);
    await send('put', `/me/close-friends/${bob.id}`).expect(404);
  });

  it('списки каждого пользователя свои', async () => {
    await send('put', `/users/${bob.id}/restrict`).expect(204);
    const bobCookie = await loginAs(app, bob);
    expect(ids(await get('/me/restricted', bobCookie).expect(200))).toEqual([]);
  });

  it('mute: сохранение, список с posts/stories, выключение', async () => {
    await send('put', `/users/${bob.id}/mute`).send({ posts: true, stories: false }).expect(204);
    const list = await get('/me/muted').expect(200);
    expect((list.body as { items: unknown[] }).items).toMatchObject([
      { id: bob.id, posts: true, stories: false },
    ]);
    await send('put', `/users/${bob.id}/mute`).send({ posts: false, stories: false }).expect(204);
    expect(ids(await get('/me/muted').expect(200))).toEqual([]);
    await send('put', `/users/${bob.id}/mute`).send({ posts: 'yes' }).expect(400);
  });

  it('избранное: список без пагинации и лимит 50 (409 LIMIT_REACHED)', async () => {
    await send('put', `/me/favorite-accounts/${bob.id}`).expect(204);
    const list = await get('/me/favorite-accounts').expect(200);
    expect((list.body as { id: string }[]).map((u) => u.id)).toEqual([bob.id]);

    for (let i = 0; i < 49; i++) {
      const u = await createUser(app);
      await send('put', `/me/favorite-accounts/${u.id}`).expect(204);
    }
    const res = await send('put', `/me/favorite-accounts/${carol.id}`).expect(409);
    expect((res.body as { code: string }).code).toBe('LIMIT_REACHED');
    await send('put', `/me/favorite-accounts/${bob.id}`).expect(204); // уже в списке — не ошибка
    await send('delete', `/me/favorite-accounts/${bob.id}`).expect(204);
    await send('put', `/me/favorite-accounts/${carol.id}`).expect(204);
  });

  it('скрытые слова: по умолчанию пусто, сохранение нормализует и убирает дубли', async () => {
    expect((await get('/me/hidden-words').expect(200)).body).toEqual({
      words: [],
      filterOffensive: false,
    });
    const res = await send('put', '/me/hidden-words')
      .send({ words: [' Spam ', 'spam', 'scam'], filterOffensive: true })
      .expect(200);
    expect(res.body).toEqual({ words: ['spam', 'scam'], filterOffensive: true });
    await send('put', '/me/hidden-words').send({ words: 'x', filterOffensive: true }).expect(400);
  });
});
