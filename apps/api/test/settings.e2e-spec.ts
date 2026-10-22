import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, createUser, loginAs, resetDb, withOrigin } from './helpers';
import { resetThrottler } from './helpers/throttler';

describe('Settings', () => {
  let app: INestApplication;
  let cookie: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(app);
    resetThrottler(app);
    cookie = await loginAs(app, await createUser(app, { userName: 'alice' }));
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const get = (path: string, c: string | null = cookie) => {
    const req = request(server()).get(`/api/v1${path}`);
    return c ? req.set('Cookie', c) : req;
  };
  const patch = (path: string, c: string | null = cookie) => {
    const req = request(server()).patch(`/api/v1${path}`).set(withOrigin());
    return c ? req.set('Cookie', c) : req;
  };

  describe('без сессии', () => {
    it('все четыре эндпоинта -> 401', async () => {
      await get('/me/settings', null).expect(401);
      await get('/me/notification-preferences', null).expect(401);
      await patch('/me/settings', null).send({}).expect(401);
      await patch('/me/notification-preferences', null).send([]).expect(401);
    });
  });

  describe('GET/PATCH /me/settings', () => {
    it('значения по умолчанию', async () => {
      const res = await get('/me/settings').expect(200);
      expect(res.body).toEqual({
        commentsFrom: 'EVERYONE',
        tagsFrom: 'EVERYONE',
        mentionsFrom: 'EVERYONE',
        showActivityStatus: true,
        hideLikeCounts: false,
        allowStoryResharing: true,
        theme: 'SYSTEM',
        language: 'ru',
      });
    });

    it('частичное изменение сохраняется, остальные поля не трогаются', async () => {
      const res = await patch('/me/settings')
        .send({ commentsFrom: 'FOLLOWING', hideLikeCounts: true, language: 'en' })
        .expect(200);
      expect(res.body).toMatchObject({
        commentsFrom: 'FOLLOWING',
        hideLikeCounts: true,
        language: 'en',
        tagsFrom: 'EVERYONE',
        showActivityStatus: true,
      });
      expect((await get('/me/settings').expect(200)).body).toEqual(res.body);
    });

    it.each([
      { commentsFrom: 'NOBODY' },
      { theme: 'PURPLE' },
      { hideLikeCounts: 'yes' },
      { language: 'x'.repeat(20) },
    ])('неверное значение %j -> 400 с details', async (body) => {
      const res = await patch('/me/settings').send(body).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('лишнее поле -> 400', async () => {
      await patch('/me/settings').send({ userId: 'x' }).expect(400);
      await patch('/me/settings').send({ role: 'ADMIN' }).expect(400);
    });

    it('смена темы ставит cookie темы: не HttpOnly, SameSite=Lax', async () => {
      const res = await patch('/me/settings').send({ theme: 'DARK' }).expect(200);
      expect(res.body.theme).toBe('DARK');
      const cookies = [res.headers['set-cookie']].flat().filter(Boolean) as string[];
      const themeCookie = cookies.find((c) => /theme=dark/i.test(c));
      expect(themeCookie).toBeDefined();
      expect(themeCookie).not.toMatch(/HttpOnly/i);
      expect(themeCookie).toMatch(/SameSite=Lax/i);
    });

    it('настройки одного пользователя не видны другому', async () => {
      await patch('/me/settings').send({ theme: 'LIGHT' }).expect(200);
      const other = await createUser(app, { userName: 'bob' });
      const res = await get('/me/settings', await loginAs(app, other)).expect(200);
      expect(res.body.theme).toBe('SYSTEM');
    });
  });

  describe('GET/PATCH /me/notification-preferences', () => {
    type Pref = { type: string; enabled: boolean };

    it('по умолчанию: массив { type, enabled }, всё включено', async () => {
      const res = await get('/me/notification-preferences').expect(200);
      const prefs = res.body as Pref[];
      expect(Array.isArray(prefs)).toBe(true);
      expect(prefs.length).toBeGreaterThan(0);
      for (const p of prefs) {
        expect(typeof p.type).toBe('string');
        expect(p.enabled).toBe(true);
      }
      expect(prefs.map((p) => p.type)).toContain('POST_LIKE');
    });

    it('изменение сохраняется и возвращается в ответе', async () => {
      const res = await patch('/me/notification-preferences')
        .send([
          { type: 'POST_LIKE', enabled: false },
          { type: 'FOLLOW', enabled: false },
        ])
        .expect(200);
      const byType = (list: Pref[]) => Object.fromEntries(list.map((p) => [p.type, p.enabled]));
      expect(byType(res.body)).toMatchObject({ POST_LIKE: false, FOLLOW: false, COMMENT: true });
      const again = await get('/me/notification-preferences').expect(200);
      expect(byType(again.body)).toMatchObject({ POST_LIKE: false, FOLLOW: false, COMMENT: true });
    });

    it('повторное включение возвращает true', async () => {
      await patch('/me/notification-preferences')
        .send([{ type: 'POST_LIKE', enabled: false }])
        .expect(200);
      const res = await patch('/me/notification-preferences')
        .send([{ type: 'POST_LIKE', enabled: true }])
        .expect(200);
      expect((res.body as Pref[]).find((p) => p.type === 'POST_LIKE')?.enabled).toBe(true);
    });

    it.each([
      [[{ type: 'NOPE', enabled: false }]],
      [[{ type: 'POST_LIKE', enabled: 'no' }]],
      [[{ type: 'POST_LIKE', enabled: false, extra: 1 }]],
      [{ type: 'POST_LIKE', enabled: false }],
    ])('неверное тело %j -> 400', async (body) => {
      const res = await patch('/me/notification-preferences').send(body).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
