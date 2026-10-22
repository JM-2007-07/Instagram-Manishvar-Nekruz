import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { setupApp } from '@/app.setup';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/mail/mail.service';
import type { MailMessage } from '@/mail/mail.service';
import { createUser, loginAs, resetDb, withOrigin } from './helpers';
import type { TestUser } from './helpers';
import { resetThrottler } from './helpers/throttler';

describe('Users: /me и профили', () => {
  let app: INestApplication;
  let inbox: MailMessage[];
  let me: TestUser;
  let cookie: string;

  beforeAll(async () => {
    inbox = [];
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({ send: (m: MailMessage) => void inbox.push(m) })
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  beforeEach(async () => {
    await resetDb(app);
    resetThrottler(app);
    inbox.length = 0;
    me = await createUser(app, { userName: 'alice', fullName: 'Alice A' });
    cookie = await loginAs(app, me);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const get = (path: string, c: string | null = cookie) => {
    const req = request(server()).get(`/api/v1${path}`);
    return c ? req.set('Cookie', c) : req;
  };
  const send = (method: 'patch' | 'put' | 'post', path: string, c: string | null = cookie) => {
    const req = request(server())[method](`/api/v1${path}`).set(withOrigin());
    return c ? req.set('Cookie', c) : req;
  };
  const codeFor = (email: string) => {
    const mail = [...inbox].reverse().find((m) => m.to.toLowerCase() === email.toLowerCase());
    if (!mail) throw new Error(`no mail sent to ${email}`);
    return /\b(\d{6})\b/.exec(mail.text)![1];
  };

  describe('без сессии', () => {
    it.each([
      ['get', '/me'],
      ['patch', '/me'],
      ['put', '/me/username'],
      ['put', '/me/email'],
      ['post', '/me/email/verify'],
      ['put', '/me/links'],
      ['get', '/users/by-username/alice'],
    ] as const)('%s %s -> 401', async (method, path) => {
      const res =
        method === 'get'
          ? await get(path, null).expect(401)
          : await send(method, path, null).send({}).expect(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('GET /users/{id} -> 401', async () => {
      await get(`/users/${me.id}`, null).expect(401);
    });
  });

  describe('GET /me', () => {
    it('возвращает Me с приватными полями и без passwordHash', async () => {
      const res = await get('/me').expect(200);
      expect(res.body).toMatchObject({
        id: me.id,
        userName: 'alice',
        fullName: 'Alice A',
        email: me.email,
        emailVerified: true,
        birthday: '2000-01-01',
        role: 'USER',
        hasPassword: true,
        isPrivate: false,
        isMe: true,
        bio: null,
        pronouns: null,
        gender: null,
        genderCustom: null,
        links: [],
        postCount: 0,
      });
      expect(res.body.avatarUrl).toBeNull();
      expect(typeof res.body.followerCount).toBe('number');
      expect(typeof res.body.followingCount).toBe('number');
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });
  });

  describe('PATCH /me', () => {
    it('меняет fullName, bio, pronouns, gender', async () => {
      const res = await send('patch', '/me')
        .send({ fullName: 'Alice B', bio: 'line1\nline2', pronouns: 'she/her', gender: 'FEMALE' })
        .expect(200);
      expect(res.body).toMatchObject({
        fullName: 'Alice B',
        bio: 'line1\nline2',
        pronouns: 'she/her',
        gender: 'FEMALE',
      });
      const again = await get('/me').expect(200);
      expect(again.body.bio).toBe('line1\nline2');
    });

    it('gender CUSTOM с genderCustom и isPrivate', async () => {
      const res = await send('patch', '/me')
        .send({ gender: 'CUSTOM', genderCustom: 'Другое', isPrivate: true })
        .expect(200);
      expect(res.body).toMatchObject({ gender: 'CUSTOM', genderCustom: 'Другое', isPrivate: true });
    });

    it('bio ровно 150 символов принимается, 151 -> 400 с details', async () => {
      await send('patch', '/me')
        .send({ bio: 'a'.repeat(150) })
        .expect(200);
      const res = await send('patch', '/me')
        .send({ bio: 'a'.repeat(151) })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details.map((d: { field: string }) => d.field)).toContain('bio');
    });

    it('fullName длиннее 64 -> 400', async () => {
      await send('patch', '/me')
        .send({ fullName: 'a'.repeat(65) })
        .expect(400);
    });

    it('pronouns длиннее 50 -> 400', async () => {
      await send('patch', '/me')
        .send({ pronouns: 'a'.repeat(51) })
        .expect(400);
    });

    it('неверный gender -> 400', async () => {
      await send('patch', '/me').send({ gender: 'ROBOT' }).expect(400);
    });

    it.each(['role', 'email', 'userName', 'isVerified'])('лишнее поле %s -> 400', async (field) => {
      const res = await send('patch', '/me')
        .send({ [field]: field === 'isVerified' ? true : 'ADMIN' })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('без Origin -> 403 CSRF_REJECTED', async () => {
      const res = await request(server())
        .patch('/api/v1/me')
        .set('Cookie', cookie)
        .send({ bio: 'x' })
        .expect(403);
      expect(res.body.code).toBe('CSRF_REJECTED');
    });
  });

  describe('PUT /me/username', () => {
    it('меняет имя пользователя', async () => {
      const res = await send('put', '/me/username').send({ userName: 'alice.new' }).expect(200);
      expect(res.body.userName).toBe('alice.new');
      expect((await get('/me').expect(200)).body.userName).toBe('alice.new');
    });

    it('занятое имя (в т.ч. в другом регистре) -> 409 CONFLICT', async () => {
      await createUser(app, { userName: 'bob' });
      const res = await send('put', '/me/username').send({ userName: 'bob' }).expect(409);
      expect(res.body.code).toBe('CONFLICT');
    });

    it('зарезервированное имя -> 400', async () => {
      const res = await send('put', '/me/username').send({ userName: 'explore' }).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('неверный формат -> 400', async () => {
      await send('put', '/me/username').send({ userName: 'bad..name' }).expect(400);
      await send('put', '/me/username').send({ userName: '' }).expect(400);
    });

    it('3-я смена за 14 дней -> 429, две первых проходят', async () => {
      await send('put', '/me/username').send({ userName: 'alice1' }).expect(200);
      await send('put', '/me/username').send({ userName: 'alice2' }).expect(200);
      const res = await send('put', '/me/username').send({ userName: 'alice3' }).expect(429);
      expect(res.body.code).toBe('RATE_LIMITED');
      expect((await get('/me').expect(200)).body.userName).toBe('alice2');
    });

    it('429 содержит Retry-After (секунды, не больше 14 дней)', async () => {
      await send('put', '/me/username').send({ userName: 'alice1' }).expect(200);
      await send('put', '/me/username').send({ userName: 'alice2' }).expect(200);
      const res = await send('put', '/me/username').send({ userName: 'alice3' }).expect(429);
      const seconds = Number(res.headers['retry-after']);
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(14 * 24 * 60 * 60);
    });

    it('имя неподтверждённого аккаунта старше 7 дней освобождается', async () => {
      const prisma = app.get(PrismaService);
      const stale = await createUser(app, { userName: 'stale' });
      await prisma.user.update({
        where: { id: stale.id },
        data: { emailVerifiedAt: null, createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000) },
      });
      await send('put', '/me/username').send({ userName: 'stale' }).expect(200);
      expect(await prisma.user.findUnique({ where: { id: stale.id } })).toBeNull();
    });

    it('старое имя 14 дней недоступно другим -> 409', async () => {
      await send('put', '/me/username').send({ userName: 'alice.renamed' }).expect(200);
      const other = await createUser(app, { userName: 'carol' });
      const otherCookie = await loginAs(app, other);
      const res = await send('put', '/me/username', otherCookie)
        .send({ userName: 'alice' })
        .expect(409);
      expect(res.body.code).toBe('CONFLICT');
    });
  });

  describe('PUT /me/email и POST /me/email/verify', () => {
    const NEW_EMAIL = 'alice.new@example.test';

    it('шлёт код на новый адрес (202), verify меняет email', async () => {
      await send('put', '/me/email').send({ email: NEW_EMAIL, password: me.password }).expect(202);
      // до подтверждения email прежний
      expect((await get('/me').expect(200)).body.email).toBe(me.email);
      const code = codeFor(NEW_EMAIL);
      const res = await send('post', '/me/email/verify').send({ code }).expect(200);
      expect(res.body.email).toBe(NEW_EMAIL);
      expect((await get('/me').expect(200)).body.email).toBe(NEW_EMAIL);
    });

    it('неверный код -> 400 VERIFICATION_CODE_INVALID, email не меняется', async () => {
      await send('put', '/me/email').send({ email: NEW_EMAIL, password: me.password }).expect(202);
      const wrong = codeFor(NEW_EMAIL) === '000000' ? '111111' : '000000';
      const res = await send('post', '/me/email/verify').send({ code: wrong }).expect(400);
      expect(res.body.code).toBe('VERIFICATION_CODE_INVALID');
      expect((await get('/me').expect(200)).body.email).toBe(me.email);
    });

    it('подтверждение смены email удаляет неиспользованные ссылки сброса пароля', async () => {
      const prisma = app.get(PrismaService);
      await prisma.passwordResetToken.create({
        data: { userId: me.id, tokenHash: 'h1', expiresAt: new Date(Date.now() + 60_000) },
      });
      await send('put', '/me/email').send({ email: NEW_EMAIL, password: me.password }).expect(202);
      await send('post', '/me/email/verify')
        .send({ code: codeFor(NEW_EMAIL) })
        .expect(200);
      expect(await prisma.passwordResetToken.count({ where: { userId: me.id } })).toBe(0);
    });

    it('verify без запроса смены -> 400', async () => {
      await send('post', '/me/email/verify').send({ code: '123456' }).expect(400);
    });

    it('занятый email -> 409', async () => {
      const other = await createUser(app, { userName: 'bob' });
      const res = await send('put', '/me/email')
        .send({ email: other.email, password: me.password })
        .expect(409);
      expect(res.body.code).toBe('CONFLICT');
      expect(inbox).toHaveLength(0);
    });

    it('невалидный email -> 400', async () => {
      await send('put', '/me/email')
        .send({ email: 'not-an-email', password: me.password })
        .expect(400);
    });
  });

  describe('PUT /me/links', () => {
    it('заменяет список целиком, порядок сохраняется', async () => {
      await send('put', '/me/links')
        .send({
          links: [{ url: 'https://a.example.test', title: 'A' }, { url: 'http://b.example.test' }],
        })
        .expect(200);
      const res = await send('put', '/me/links')
        .send({
          links: [{ url: 'https://c.example.test', title: 'C' }, { url: 'https://d.example.test' }],
        })
        .expect(200);
      expect(res.body.links).toEqual([
        { url: 'https://c.example.test', title: 'C' },
        { url: 'https://d.example.test', title: null },
      ]);
      expect((await get('/me').expect(200)).body.links).toHaveLength(2);
    });

    it('пустой список очищает ссылки', async () => {
      await send('put', '/me/links')
        .send({ links: [{ url: 'https://a.example.test' }] })
        .expect(200);
      const res = await send('put', '/me/links').send({ links: [] }).expect(200);
      expect(res.body.links).toEqual([]);
    });

    it('5 ссылок можно, 6 -> 409 LIMIT_REACHED и прежний список цел', async () => {
      const mk = (n: number) =>
        Array.from({ length: n }, (_, i) => ({ url: `https://site${i}.example.test` }));
      await send('put', '/me/links')
        .send({ links: mk(5) })
        .expect(200);
      const res = await send('put', '/me/links')
        .send({ links: mk(6) })
        .expect(409);
      expect(res.body.code).toBe('LIMIT_REACHED');
      expect((await get('/me').expect(200)).body.links).toHaveLength(5);
    });

    it.each(['ftp://a.example.test', 'javascript:alert(1)', 'example.test'])(
      'url %s (не http/https) -> 400',
      async (url) => {
        const res = await send('put', '/me/links')
          .send({ links: [{ url }] })
          .expect(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      },
    );

    it('заголовок 30 символов можно, 31 -> 400', async () => {
      await send('put', '/me/links')
        .send({ links: [{ url: 'https://a.example.test', title: 'a'.repeat(30) }] })
        .expect(200);
      await send('put', '/me/links')
        .send({ links: [{ url: 'https://a.example.test', title: 'a'.repeat(31) }] })
        .expect(400);
    });

    it('links не массив -> 400', async () => {
      await send('put', '/me/links').send({ links: 'x' }).expect(400);
      await send('put', '/me/links').send({}).expect(400);
    });
  });

  describe('GET /users/{id} и /users/by-username/{userName}', () => {
    let bob: TestUser;

    beforeEach(async () => {
      bob = await createUser(app, { userName: 'bob', fullName: 'Bob B' });
    });

    it('чужой профиль: форма Profile без приватных полей', async () => {
      const res = await get(`/users/${bob.id}`).expect(200);
      expect(res.body).toMatchObject({
        id: bob.id,
        userName: 'bob',
        fullName: 'Bob B',
        isMe: false,
        isPrivate: false,
        bio: null,
        links: [],
        postCount: 0,
      });
      expect(typeof res.body.followerCount).toBe('number');
      expect(typeof res.body.followingCount).toBe('number');
      expect(typeof res.body.canViewContent).toBe('boolean');
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain(bob.email);
      expect(raw).not.toContain('2000-01-01');
      expect(raw).not.toContain('passwordHash');
      expect(res.body).not.toHaveProperty('email');
      expect(res.body).not.toHaveProperty('birthday');
    });

    it('свой профиль через /users/{id}: isMe=true', async () => {
      const res = await get(`/users/${me.id}`).expect(200);
      expect(res.body.isMe).toBe(true);
    });

    it('by-username без учёта регистра', async () => {
      const res = await get('/users/by-username/BoB').expect(200);
      expect(res.body.id).toBe(bob.id);
      expect(res.body.userName).toBe('bob');
    });

    it('закрытый аккаунт: шапка видна, canViewContent=false для неподписанного', async () => {
      const priv = await createUser(app, { userName: 'secret', isPrivate: true });
      const res = await get(`/users/${priv.id}`).expect(200);
      expect(res.body.isPrivate).toBe(true);
      expect(res.body.canViewContent).toBe(false);
    });

    it('свой закрытый профиль: canViewContent=true', async () => {
      await send('patch', '/me').send({ isPrivate: true }).expect(200);
      const res = await get(`/users/${me.id}`).expect(200);
      expect(res.body.canViewContent).toBe(true);
    });

    it('неподтверждённый аккаунт -> 404', async () => {
      const ghost = await createUser(app, { userName: 'ghost' });
      await app.get(PrismaService).user.update({
        where: { id: ghost.id },
        data: { emailVerifiedAt: null },
      });
      await get(`/users/${ghost.id}`).expect(404);
      await get('/users/by-username/ghost').expect(404);
    });

    it('несуществующий id и имя -> 404', async () => {
      const res = await get('/users/00000000-0000-4000-8000-000000000000').expect(404);
      expect(res.body.code).toBe('NOT_FOUND');
      await get('/users/by-username/nobody').expect(404);
    });

    it('не-UUID -> 400', async () => {
      await get('/users/not-a-uuid').expect(400);
    });
  });
});
